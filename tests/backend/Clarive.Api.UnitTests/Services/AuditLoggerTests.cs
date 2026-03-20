using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Core.Services;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class AuditLoggerTests
{
    private readonly IAuditLogRepository _auditRepo = Substitute.For<IAuditLogRepository>();
    private readonly AuditLogger _sut;

    public AuditLoggerTests()
    {
        _auditRepo
            .AddAsync(Arg.Any<AuditLogEntry>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);
        _sut = new AuditLogger(_auditRepo);
    }

    [Fact]
    public async Task LogAsync_CreatesEntryWithCorrectFields()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await _sut.LogAsync(
            tenantId,
            userId,
            "Jane Doe",
            AuditAction.EntryCreated,
            "PromptEntry",
            Guid.NewGuid(),
            "My Prompt",
            "some details"
        );

        await _auditRepo
            .Received(1)
            .AddAsync(
                Arg.Is<AuditLogEntry>(e =>
                    e.TenantId == tenantId
                    && e.UserId == userId
                    && e.UserName == "Jane Doe"
                    && e.Action == AuditAction.EntryCreated
                    && e.EntityType == "PromptEntry"
                    && e.EntityTitle == "My Prompt"
                    && e.Details == "some details"
                ),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task LogAsync_SetsExpiresAt30DaysFromNow()
    {
        var before = DateTime.UtcNow;

        await _sut.LogAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "User",
            AuditAction.EntryDeleted,
            "PromptEntry",
            Guid.NewGuid(),
            "Title"
        );

        await _auditRepo
            .Received(1)
            .AddAsync(
                Arg.Is<AuditLogEntry>(e =>
                    e.ExpiresAt >= before.AddDays(30)
                    && e.ExpiresAt <= DateTime.UtcNow.AddDays(30).AddSeconds(1)
                ),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task LogAsync_NullDetails_SetsDetailsNull()
    {
        await _sut.LogAsync(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "User",
            AuditAction.ApiGet,
            "PromptEntry",
            Guid.NewGuid(),
            "Title"
        );

        await _auditRepo
            .Received(1)
            .AddAsync(Arg.Is<AuditLogEntry>(e => e.Details == null), Arg.Any<CancellationToken>());
    }
}
