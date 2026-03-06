using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Microsoft.EntityFrameworkCore;
using Clarive.Api.Auth;

namespace Clarive.Api.Endpoints;

public static class FeedbackEndpoints
{
    public static IEndpointRouteBuilder MapFeedbackEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/feedback", HandleSubmit)
            .WithTags("Feedback")
            .RequireAuthorization();

        app.MapGet("/api/super/feedback", HandleGetAll)
            .WithTags("Feedback")
            .RequireAuthorization("SuperUser");

        return app;
    }

    private static async Task<IResult> HandleSubmit(
        SubmitFeedbackRequest request,
        HttpContext ctx,
        ClariveDbContext db,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return Results.BadRequest(new
            {
                error = new { code = "EMPTY_MESSAGE", message = "Message is required." }
            });

        if (request.Message.Length > 2000)
            return Results.BadRequest(new
            {
                error = new { code = "MESSAGE_TOO_LONG", message = "Message must be 2000 characters or less." }
            });

        if (!Enum.TryParse<FeedbackCategory>(request.Category, ignoreCase: true, out var category))
            return Results.BadRequest(new
            {
                error = new { code = "INVALID_CATEGORY", message = "Category must be Bug, FeatureRequest, or General." }
            });

        var userId = ctx.GetUserId();
        var userEmail = await db.Users.Where(u => u.Id == userId)
            .Select(u => u.Email).FirstOrDefaultAsync(ct) ?? "";

        var entry = new FeedbackEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            UserName = ctx.GetUserName(),
            UserEmail = userEmail,
            Category = category,
            Message = request.Message.Trim(),
            PageUrl = request.PageUrl,
            UserAgent = ctx.Request.Headers.UserAgent.ToString(),
            CreatedAt = DateTime.UtcNow,
        };

        db.FeedbackEntries.Add(entry);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new { submitted = true });
    }

    private static async Task<IResult> HandleGetAll(
        ClariveDbContext db,
        CancellationToken ct,
        int page = 1,
        int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = db.FeedbackEntries
            .AsNoTracking()
            .OrderByDescending(f => f.CreatedAt);

        var total = await query.CountAsync(ct);
        var entries = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new FeedbackEntryResponse(
                f.Id,
                f.UserName,
                f.UserEmail,
                f.Category.ToString(),
                f.Message,
                f.PageUrl,
                f.UserAgent,
                f.CreatedAt))
            .ToListAsync(ct);

        return Results.Ok(new { entries, total, page, pageSize });
    }
}
