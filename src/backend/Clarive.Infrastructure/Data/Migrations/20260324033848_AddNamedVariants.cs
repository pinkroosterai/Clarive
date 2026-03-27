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

            // 2. Modify ab_test_runs only if the table exists (it was removed from InitialCreate
            //    during a migration squash, so fresh databases won't have it)
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ab_test_runs') THEN
                        ALTER TABLE ab_test_runs ADD COLUMN IF NOT EXISTS version_a_id uuid;
                        ALTER TABLE ab_test_runs ADD COLUMN IF NOT EXISTS version_b_id uuid;
                        ALTER TABLE ab_test_runs ADD COLUMN IF NOT EXISTS version_a_label varchar(100);
                        ALTER TABLE ab_test_runs ADD COLUMN IF NOT EXISTS version_b_label varchar(100);

                        UPDATE ab_test_runs r
                        SET version_a_id = v.id, version_a_label = 'v' || r.version_a_number
                        FROM prompt_entry_versions v
                        WHERE v.entry_id = r.entry_id AND v.version = r.version_a_number;

                        UPDATE ab_test_runs r
                        SET version_b_id = v.id, version_b_label = 'v' || r.version_b_number
                        FROM prompt_entry_versions v
                        WHERE v.entry_id = r.entry_id AND v.version = r.version_b_number;

                        ALTER TABLE ab_test_runs DROP COLUMN IF EXISTS version_a_number;
                        ALTER TABLE ab_test_runs DROP COLUMN IF EXISTS version_b_number;

                        CREATE INDEX IF NOT EXISTS "IX_ab_test_runs_version_a_id" ON ab_test_runs (version_a_id);
                        CREATE INDEX IF NOT EXISTS "IX_ab_test_runs_version_b_id" ON ab_test_runs (version_b_id);

                        ALTER TABLE ab_test_runs ADD CONSTRAINT "FK_ab_test_runs_prompt_entry_versions_version_a_id"
                            FOREIGN KEY (version_a_id) REFERENCES prompt_entry_versions(id) ON DELETE SET NULL;
                        ALTER TABLE ab_test_runs ADD CONSTRAINT "FK_ab_test_runs_prompt_entry_versions_version_b_id"
                            FOREIGN KEY (version_b_id) REFERENCES prompt_entry_versions(id) ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "uq_prompt_entry_versions_entry_variant_name",
                table: "prompt_entry_versions");

            migrationBuilder.DropColumn(
                name: "based_on_version",
                table: "prompt_entry_versions");

            migrationBuilder.DropColumn(
                name: "variant_name",
                table: "prompt_entry_versions");

            // Reverse ab_test_runs changes only if the table exists
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ab_test_runs') THEN
                        ALTER TABLE ab_test_runs DROP CONSTRAINT IF EXISTS "FK_ab_test_runs_prompt_entry_versions_version_a_id";
                        ALTER TABLE ab_test_runs DROP CONSTRAINT IF EXISTS "FK_ab_test_runs_prompt_entry_versions_version_b_id";
                        DROP INDEX IF EXISTS "IX_ab_test_runs_version_a_id";
                        DROP INDEX IF EXISTS "IX_ab_test_runs_version_b_id";
                        ALTER TABLE ab_test_runs DROP COLUMN IF EXISTS version_a_id;
                        ALTER TABLE ab_test_runs DROP COLUMN IF EXISTS version_a_label;
                        ALTER TABLE ab_test_runs DROP COLUMN IF EXISTS version_b_id;
                        ALTER TABLE ab_test_runs DROP COLUMN IF EXISTS version_b_label;
                        ALTER TABLE ab_test_runs ADD COLUMN version_a_number integer NOT NULL DEFAULT 0;
                        ALTER TABLE ab_test_runs ADD COLUMN version_b_number integer NOT NULL DEFAULT 0;
                    END IF;
                END $$;
                """);
        }
    }
}
