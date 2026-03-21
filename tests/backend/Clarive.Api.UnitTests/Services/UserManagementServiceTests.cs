using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class UserManagementServiceTests : IDisposable
{
    private readonly IUserRepository _userRepo = Substitute.For<IUserRepository>();
    private readonly ITenantMembershipRepository _membershipRepo =
        Substitute.For<ITenantMembershipRepository>();
    private readonly IInvitationRepository _invitationRepo =
        Substitute.For<IInvitationRepository>();
    private readonly ClariveDbContext _db;
    private readonly UserManagementService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    public UserManagementServiceTests()
    {
        var options = new DbContextOptionsBuilder<ClariveDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _db = new ClariveDbContext(options);

        _userRepo
            .UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<User>());
        _membershipRepo
            .UpdateAsync(Arg.Any<TenantMembership>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        _sut = new UserManagementService(_userRepo, _membershipRepo, _invitationRepo, _db, Substitute.For<ILogger<UserManagementService>>());
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── ListMembersAsync ──

    [Fact]
    public async Task ListMembersAsync_ReturnsActiveAndPendingMembers()
    {
        var users = new List<User>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "a@test.com",
                Name = "Alice",
                Role = UserRole.Admin,
                CreatedAt = DateTime.UtcNow,
            },
        };
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "b@test.com",
                Role = UserRole.Editor,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(7),
            },
        };

        _userRepo
            .GetByTenantPagedAsync(TenantId, 1, 50, Arg.Any<CancellationToken>())
            .Returns((users, 1));
        _invitationRepo
            .GetActiveByTenantAsync(TenantId, Arg.Any<CancellationToken>())
            .Returns(invitations);

        var result = await _sut.ListMembersAsync(TenantId, 1, 50, default);

        result.Items.Should().HaveCount(2);
        result.Items.Should().Contain(m => m.Status == "active" && m.Email == "a@test.com");
        result.Items.Should().Contain(m => m.Status == "pending" && m.Email == "b@test.com");
    }

    [Fact]
    public async Task ListMembersAsync_ClampsPagination()
    {
        _userRepo
            .GetByTenantPagedAsync(TenantId, 1, 50, Arg.Any<CancellationToken>())
            .Returns((new List<User>(), 0));
        _invitationRepo
            .GetActiveByTenantAsync(TenantId, Arg.Any<CancellationToken>())
            .Returns(new List<Invitation>());

        var result = await _sut.ListMembersAsync(TenantId, -1, 999, default);

        result.Page.Should().Be(1);
        result.PageSize.Should().Be(50);
    }

    // ── ChangeRoleAsync ──

    [Fact]
    public async Task ChangeRoleAsync_UserNotFound_ReturnsNotFound()
    {
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns((User?)null);

        var result = await _sut.ChangeRoleAsync(TenantId, UserId, UserRole.Editor, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ChangeRoleAsync_MembershipNotFound_ReturnsNotFound()
    {
        _userRepo
            .GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>())
            .Returns(
                new User
                {
                    Id = UserId,
                    TenantId = TenantId,
                    Role = UserRole.Admin,
                }
            );
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns((TenantMembership?)null);

        var result = await _sut.ChangeRoleAsync(TenantId, UserId, UserRole.Editor, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("MEMBERSHIP_NOT_FOUND");
    }

    [Fact]
    public async Task ChangeRoleAsync_ActiveWorkspace_UpdatesUserAndMembership()
    {
        var user = new User
        {
            Id = UserId,
            TenantId = TenantId,
            Role = UserRole.Viewer,
        };
        var membership = new TenantMembership
        {
            UserId = UserId,
            TenantId = TenantId,
            Role = UserRole.Viewer,
        };

        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns(membership);

        var result = await _sut.ChangeRoleAsync(TenantId, UserId, UserRole.Editor, default);

        result.IsError.Should().BeFalse();
        result.Value.NewRole.Should().Be("editor");
        result.Value.OldRole.Should().Be("viewer");
        membership.Role.Should().Be(UserRole.Editor);
        user.Role.Should().Be(UserRole.Editor);
        await _userRepo.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ChangeRoleAsync_NonActiveWorkspace_OnlyUpdatesMembership()
    {
        var otherTenantId = Guid.NewGuid();
        var user = new User
        {
            Id = UserId,
            TenantId = otherTenantId,
            Role = UserRole.Admin,
        };
        var membership = new TenantMembership
        {
            UserId = UserId,
            TenantId = TenantId,
            Role = UserRole.Viewer,
        };

        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns(membership);

        var result = await _sut.ChangeRoleAsync(TenantId, UserId, UserRole.Editor, default);

        result.IsError.Should().BeFalse();
        membership.Role.Should().Be(UserRole.Editor);
        user.Role.Should().Be(UserRole.Admin); // unchanged
        await _userRepo.DidNotReceive().UpdateAsync(user, Arg.Any<CancellationToken>());
    }

    // ── RemoveMemberAsync ──

    [Fact]
    public async Task RemoveMemberAsync_UserNotFound_ReturnsNotFound()
    {
        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns((User?)null);

        var result = await _sut.RemoveMemberAsync(TenantId, UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task RemoveMemberAsync_LastAdmin_ReturnsConflict()
    {
        var user = new User
        {
            Id = UserId,
            TenantId = TenantId,
            Role = UserRole.Admin,
        };
        var membership = new TenantMembership
        {
            UserId = UserId,
            TenantId = TenantId,
            Role = UserRole.Admin,
        };

        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns(membership);
        _membershipRepo.CountAdminsAsync(TenantId, Arg.Any<CancellationToken>()).Returns(1);

        var result = await _sut.RemoveMemberAsync(TenantId, UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("LAST_ADMIN");
    }

    [Fact]
    public async Task RemoveMemberAsync_NotLastAdmin_RemovesMembership()
    {
        var user = new User
        {
            Id = UserId,
            TenantId = TenantId,
            Role = UserRole.Admin,
        };
        var membership = new TenantMembership
        {
            UserId = UserId,
            TenantId = TenantId,
            Role = UserRole.Admin,
        };
        var personalTenantId = Guid.NewGuid();

        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(user);
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns(membership);
        _membershipRepo.CountAdminsAsync(TenantId, Arg.Any<CancellationToken>()).Returns(2);
        _userRepo
            .GetByIdCrossTenantsAsync(UserId, Arg.Any<CancellationToken>())
            .Returns(new User { Id = UserId, TenantId = TenantId });
        _membershipRepo
            .GetByUserIdAsync(UserId, Arg.Any<CancellationToken>())
            .Returns(
                new List<TenantMembership>
                {
                    new()
                    {
                        TenantId = personalTenantId,
                        Role = UserRole.Admin,
                        IsPersonal = true,
                    },
                }
            );

        var result = await _sut.RemoveMemberAsync(TenantId, UserId, default);

        result.IsError.Should().BeFalse();
        await _membershipRepo
            .Received(1)
            .DeleteAsync(UserId, TenantId, Arg.Any<CancellationToken>());
    }

    // ── TransferOwnershipAsync ──

    [Fact]
    public async Task TransferOwnershipAsync_TargetNotFound_ReturnsNotFound()
    {
        _userRepo
            .GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.TransferOwnershipAsync(TenantId, Guid.NewGuid(), UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("TARGET_NOT_FOUND");
    }

    [Fact]
    public async Task TransferOwnershipAsync_CurrentNotFound_ReturnsNotFound()
    {
        var currentUserId = Guid.NewGuid();
        _userRepo
            .GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>())
            .Returns(new User { Id = UserId });
        _userRepo
            .GetByIdAsync(TenantId, currentUserId, Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var result = await _sut.TransferOwnershipAsync(TenantId, currentUserId, UserId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("CURRENT_NOT_FOUND");
    }

    [Fact]
    public async Task TransferOwnershipAsync_Valid_SwapsRoles()
    {
        var currentUserId = Guid.NewGuid();
        var currentUser = new User
        {
            Id = currentUserId,
            TenantId = TenantId,
            Role = UserRole.Admin,
        };
        var targetUser = new User
        {
            Id = UserId,
            TenantId = TenantId,
            Role = UserRole.Editor,
        };
        var currentMembership = new TenantMembership
        {
            UserId = currentUserId,
            TenantId = TenantId,
            Role = UserRole.Admin,
        };
        var targetMembership = new TenantMembership
        {
            UserId = UserId,
            TenantId = TenantId,
            Role = UserRole.Editor,
        };

        _userRepo.GetByIdAsync(TenantId, UserId, Arg.Any<CancellationToken>()).Returns(targetUser);
        _userRepo
            .GetByIdAsync(TenantId, currentUserId, Arg.Any<CancellationToken>())
            .Returns(currentUser);
        _membershipRepo
            .GetAsync(currentUserId, TenantId, Arg.Any<CancellationToken>())
            .Returns(currentMembership);
        _membershipRepo
            .GetAsync(UserId, TenantId, Arg.Any<CancellationToken>())
            .Returns(targetMembership);

        var result = await _sut.TransferOwnershipAsync(TenantId, currentUserId, UserId, default);

        result.IsError.Should().BeFalse();
        currentUser.Role.Should().Be(UserRole.Editor);
        targetUser.Role.Should().Be(UserRole.Admin);
        currentMembership.Role.Should().Be(UserRole.Editor);
        targetMembership.Role.Should().Be(UserRole.Admin);
    }
}
