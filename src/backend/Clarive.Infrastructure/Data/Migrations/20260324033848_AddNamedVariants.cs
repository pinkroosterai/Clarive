using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNamedVariants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add variant fields to prompt_entry_versions
            migrationBuilder.AddColumn<int>(
                name: "based_on_version",
                table: "prompt_entry_versions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "variant_name",
                table: "prompt_entry_versions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "uq_prompt_entry_versions_entry_variant_name",
                table: "prompt_entry_versions",
                columns: new[] { "entry_id", "variant_name" },
                unique: true,
                filter: "variant_name IS NOT NULL");

            // 2. Add new version ID columns to ab_test_runs (before dropping old ones)
            migrationBuilder.AddColumn<Guid>(
                name: "version_a_id",
                table: "ab_test_runs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "version_b_id",
                table: "ab_test_runs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "version_a_label",
                table: "ab_test_runs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "version_b_label",
                table: "ab_test_runs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            // 3. Data migration: populate version GUIDs and labels from existing version numbers
            migrationBuilder.Sql("""
                UPDATE ab_test_runs r
                SET version_a_id = v.id,
                    version_a_label = 'v' || r.version_a_number
                FROM prompt_entry_versions v
                WHERE v.entry_id = r.entry_id AND v.version = r.version_a_number;
                """);

            migrationBuilder.Sql("""
                UPDATE ab_test_runs r
                SET version_b_id = v.id,
                    version_b_label = 'v' || r.version_b_number
                FROM prompt_entry_versions v
                WHERE v.entry_id = r.entry_id AND v.version = r.version_b_number;
                """);

            // 4. Drop old version number columns
            migrationBuilder.DropColumn(
                name: "version_a_number",
                table: "ab_test_runs");

            migrationBuilder.DropColumn(
                name: "version_b_number",
                table: "ab_test_runs");

            // 5. Add indexes and FKs for new version ID columns
            migrationBuilder.CreateIndex(
                name: "IX_ab_test_runs_version_a_id",
                table: "ab_test_runs",
                column: "version_a_id");

            migrationBuilder.CreateIndex(
                name: "IX_ab_test_runs_version_b_id",
                table: "ab_test_runs",
                column: "version_b_id");

            migrationBuilder.AddForeignKey(
                name: "FK_ab_test_runs_prompt_entry_versions_version_a_id",
                table: "ab_test_runs",
                column: "version_a_id",
                principalTable: "prompt_entry_versions",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ab_test_runs_prompt_entry_versions_version_b_id",
                table: "ab_test_runs",
                column: "version_b_id",
                principalTable: "prompt_entry_versions",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ab_test_runs_prompt_entry_versions_version_a_id",
                table: "ab_test_runs");

            migrationBuilder.DropForeignKey(
                name: "FK_ab_test_runs_prompt_entry_versions_version_b_id",
                table: "ab_test_runs");

            migrationBuilder.DropIndex(
                name: "uq_prompt_entry_versions_entry_variant_name",
                table: "prompt_entry_versions");

            migrationBuilder.DropIndex(
                name: "IX_ab_test_runs_version_a_id",
                table: "ab_test_runs");

            migrationBuilder.DropIndex(
                name: "IX_ab_test_runs_version_b_id",
                table: "ab_test_runs");

            migrationBuilder.DropColumn(
                name: "based_on_version",
                table: "prompt_entry_versions");

            migrationBuilder.DropColumn(
                name: "variant_name",
                table: "prompt_entry_versions");

            migrationBuilder.DropColumn(
                name: "version_a_id",
                table: "ab_test_runs");

            migrationBuilder.DropColumn(
                name: "version_a_label",
                table: "ab_test_runs");

            migrationBuilder.DropColumn(
                name: "version_b_id",
                table: "ab_test_runs");

            migrationBuilder.DropColumn(
                name: "version_b_label",
                table: "ab_test_runs");

            migrationBuilder.AddColumn<int>(
                name: "version_a_number",
                table: "ab_test_runs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "version_b_number",
                table: "ab_test_runs",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
