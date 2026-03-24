using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class TabsRedesign : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "uq_prompt_entry_versions_entry_variant_name",
                table: "prompt_entry_versions");

            migrationBuilder.DropIndex(
                name: "uq_prompt_entry_versions_entry_version",
                table: "prompt_entry_versions");

            migrationBuilder.RenameColumn(
                name: "\"order\"",
                table: "prompts",
                newName: "sort_order");

            migrationBuilder.RenameColumn(
                name: "variant_name",
                table: "prompt_entry_versions",
                newName: "tab_name");

            migrationBuilder.RenameColumn(
                name: "based_on_version",
                table: "prompt_entry_versions",
                newName: "forked_from_version");

            migrationBuilder.AddColumn<bool>(
                name: "is_main_tab",
                table: "prompt_entry_versions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "uq_prompt_entry_versions_entry_tab_name",
                table: "prompt_entry_versions",
                columns: new[] { "entry_id", "tab_name" },
                unique: true,
                filter: "tab_name IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "uq_prompt_entry_versions_entry_version",
                table: "prompt_entry_versions",
                columns: new[] { "entry_id", "version" },
                unique: true,
                filter: "version_state != 'Tab'");

            // ── Data migration ──

            migrationBuilder.Sql("""
                UPDATE prompt_entry_versions
                SET version_state = 'Tab', tab_name = 'Main', is_main_tab = true
                WHERE version_state = 'Draft';
                """);

            migrationBuilder.Sql("""
                UPDATE prompt_entry_versions
                SET version_state = 'Tab'
                WHERE version_state = 'Variant';
                """);

            migrationBuilder.Sql("""
                INSERT INTO prompt_entry_versions (
                    id, entry_id, version, version_state, system_message,
                    published_at, published_by, created_at,
                    tab_name, forked_from_version, is_main_tab
                )
                SELECT gen_random_uuid(), pev.entry_id, 0, 'Tab', pev.system_message,
                    NULL, NULL, NOW(), 'Main', pev.version, true
                FROM prompt_entry_versions pev
                WHERE pev.version_state = 'Published'
                  AND NOT EXISTS (
                      SELECT 1 FROM prompt_entry_versions t
                      WHERE t.entry_id = pev.entry_id AND t.version_state = 'Tab'
                  );
                """);

            migrationBuilder.Sql("""
                INSERT INTO prompts (id, version_id, content, sort_order, is_template)
                SELECT gen_random_uuid(), new_tab.id, p.content, p.sort_order, p.is_template
                FROM prompt_entry_versions new_tab
                JOIN prompt_entry_versions published
                    ON published.entry_id = new_tab.entry_id AND published.version_state = 'Published'
                JOIN prompts p ON p.version_id = published.id
                WHERE new_tab.version_state = 'Tab'
                  AND new_tab.is_main_tab = true AND new_tab.forked_from_version IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                INSERT INTO template_fields (id, prompt_id, name, type, enum_values, default_value, min, max)
                SELECT gen_random_uuid(), new_prompt.id, tf.name, tf.type, tf.enum_values,
                    tf.default_value, tf.min, tf.max
                FROM prompt_entry_versions new_tab
                JOIN prompts new_prompt ON new_prompt.version_id = new_tab.id
                JOIN prompt_entry_versions published
                    ON published.entry_id = new_tab.entry_id AND published.version_state = 'Published'
                JOIN prompts old_prompt
                    ON old_prompt.version_id = published.id AND old_prompt.sort_order = new_prompt.sort_order
                JOIN template_fields tf ON tf.prompt_id = old_prompt.id
                WHERE new_tab.version_state = 'Tab'
                  AND new_tab.is_main_tab = true AND new_tab.forked_from_version IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM prompt_entry_versions WHERE version_state = 'Tab' AND is_main_tab = true AND forked_from_version IS NOT NULL;");
            migrationBuilder.Sql("UPDATE prompt_entry_versions SET version_state = 'Variant' WHERE version_state = 'Tab' AND is_main_tab = false;");
            migrationBuilder.Sql("UPDATE prompt_entry_versions SET version_state = 'Draft', tab_name = NULL, is_main_tab = false WHERE version_state = 'Tab' AND is_main_tab = true;");

            migrationBuilder.DropIndex(
                name: "uq_prompt_entry_versions_entry_tab_name",
                table: "prompt_entry_versions");

            migrationBuilder.DropIndex(
                name: "uq_prompt_entry_versions_entry_version",
                table: "prompt_entry_versions");

            migrationBuilder.DropColumn(
                name: "is_main_tab",
                table: "prompt_entry_versions");

            migrationBuilder.RenameColumn(
                name: "sort_order",
                table: "prompts",
                newName: "\"order\"");

            migrationBuilder.RenameColumn(
                name: "tab_name",
                table: "prompt_entry_versions",
                newName: "variant_name");

            migrationBuilder.RenameColumn(
                name: "forked_from_version",
                table: "prompt_entry_versions",
                newName: "based_on_version");

            migrationBuilder.CreateIndex(
                name: "uq_prompt_entry_versions_entry_variant_name",
                table: "prompt_entry_versions",
                columns: new[] { "entry_id", "variant_name" },
                unique: true,
                filter: "variant_name IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "uq_prompt_entry_versions_entry_version",
                table: "prompt_entry_versions",
                columns: new[] { "entry_id", "version" },
                unique: true);
        }
    }
}
