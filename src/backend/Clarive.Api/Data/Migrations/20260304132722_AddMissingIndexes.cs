using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_refresh_tokens_user_id",
                table: "refresh_tokens");

            migrationBuilder.DropIndex(
                name: "ix_prompt_entries_tenant_folder",
                table: "prompt_entries");

            migrationBuilder.DropIndex(
                name: "ix_prompt_entries_tenant_trash",
                table: "prompt_entries");

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_user_active",
                table: "refresh_tokens",
                column: "user_id",
                filter: "revoked_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "uq_prompt_entry_versions_entry_version",
                table: "prompt_entry_versions",
                columns: new[] { "entry_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entries_tenant_folder",
                table: "prompt_entries",
                columns: new[] { "tenant_id", "folder_id", "updated_at" },
                descending: new[] { false, false, true },
                filter: "NOT is_trashed");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entries_tenant_id",
                table: "prompt_entries",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entries_tenant_trash",
                table: "prompt_entries",
                columns: new[] { "tenant_id", "updated_at" },
                descending: new[] { false, true },
                filter: "is_trashed");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_refresh_tokens_user_active",
                table: "refresh_tokens");

            migrationBuilder.DropIndex(
                name: "uq_prompt_entry_versions_entry_version",
                table: "prompt_entry_versions");

            migrationBuilder.DropIndex(
                name: "ix_prompt_entries_tenant_folder",
                table: "prompt_entries");

            migrationBuilder.DropIndex(
                name: "ix_prompt_entries_tenant_id",
                table: "prompt_entries");

            migrationBuilder.DropIndex(
                name: "ix_prompt_entries_tenant_trash",
                table: "prompt_entries");

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_user_id",
                table: "refresh_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entries_tenant_folder",
                table: "prompt_entries",
                columns: new[] { "tenant_id", "folder_id" },
                filter: "NOT is_trashed");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entries_tenant_trash",
                table: "prompt_entries",
                column: "tenant_id",
                filter: "is_trashed");
        }
    }
}
