using Clarive.Application.Variants.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using ErrorOr;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.Variants.Services;

public class VariantService(
    IEntryRepository entryRepo,
    IUnitOfWork unitOfWork,
    ILogger<VariantService> logger
) : IVariantService
{
    private const int MaxVariantsPerEntry = 20;

    public async Task<ErrorOr<VariantInfo>> CreateAsync(
        Guid tenantId, Guid entryId, CreateVariantRequest request, CancellationToken ct = default)
    {
        var validationErr = Common.Validator.ValidateRequest(request);
        if (validationErr is not null)
            return Error.Validation("VALIDATION_ERROR", "Invalid request.");

        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        // Validate base version exists
        var baseVersion = await entryRepo.GetVersionAsync(tenantId, entryId, request.BasedOnVersion, ct);
        if (baseVersion is null)
            return DomainErrors.VersionNotFound;

        // Check duplicate name
        var existing = await entryRepo.GetVariantByNameAsync(tenantId, entryId, request.Name, ct);
        if (existing is not null)
            return DomainErrors.DuplicateVariantName;

        // Check max variants limit
        var variants = await entryRepo.GetVariantsAsync(tenantId, entryId, ct);
        if (variants.Count >= MaxVariantsPerEntry)
            return DomainErrors.MaxVariantsExceeded;

        // Create variant by forking content from base version
        var variantId = Guid.NewGuid();
        var variant = new PromptEntryVersion
        {
            Id = variantId,
            EntryId = entryId,
            Version = 0, // Variants don't have version numbers until published
            VersionState = VersionState.Variant,
            VariantName = request.Name,
            BasedOnVersion = request.BasedOnVersion,
            SystemMessage = baseVersion.SystemMessage,
            Prompts = Common.PromptCloner.ClonePrompts(baseVersion.Prompts, variantId),
            CreatedAt = DateTime.UtcNow,
        };

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await entryRepo.CreateVersionAsync(variant, ct);
        }, ct);

        logger.LogInformation("Created variant '{VariantName}' for entry {EntryId} based on v{BaseVersion}",
            request.Name, entryId, request.BasedOnVersion);

        return new VariantInfo(variant.Id, variant.VariantName!, variant.BasedOnVersion!.Value, variant.CreatedAt);
    }

    public async Task<ErrorOr<List<VariantInfo>>> ListAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        var variants = await entryRepo.GetVariantsAsync(tenantId, entryId, ct);

        return variants.Select(v => new VariantInfo(
            v.Id,
            v.VariantName!,
            v.BasedOnVersion ?? 0,
            v.CreatedAt
        )).ToList();
    }

    public async Task<ErrorOr<VariantInfo>> RenameAsync(
        Guid tenantId, Guid entryId, Guid variantId, RenameVariantRequest request, CancellationToken ct = default)
    {
        var validationErr = Common.Validator.ValidateRequest(request);
        if (validationErr is not null)
            return Error.Validation("VALIDATION_ERROR", "Invalid request.");

        var variant = await entryRepo.GetVersionByIdAsync(tenantId, variantId, ct);
        if (variant is null || variant.EntryId != entryId || variant.VersionState != VersionState.Variant)
            return DomainErrors.VariantNotFound;

        // Check duplicate name
        var existing = await entryRepo.GetVariantByNameAsync(tenantId, entryId, request.NewName, ct);
        if (existing is not null && existing.Id != variantId)
            return DomainErrors.DuplicateVariantName;

        variant.VariantName = request.NewName;
        await entryRepo.UpdateVersionAsync(variant, ct);

        return new VariantInfo(variant.Id, variant.VariantName!, variant.BasedOnVersion ?? 0, variant.CreatedAt);
    }

    public async Task<ErrorOr<bool>> DeleteAsync(
        Guid tenantId, Guid entryId, Guid variantId, CancellationToken ct = default)
    {
        var variant = await entryRepo.GetVersionByIdAsync(tenantId, variantId, ct);
        if (variant is null || variant.EntryId != entryId || variant.VersionState != VersionState.Variant)
            return DomainErrors.VariantNotFound;

        await entryRepo.DeleteVersionAsync(variant, ct);

        logger.LogInformation("Deleted variant '{VariantName}' ({VariantId}) for entry {EntryId}",
            variant.VariantName, variantId, entryId);

        return true;
    }
}
