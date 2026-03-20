using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRenderedPromptsToPlaygroundRun : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "rendered_prompts",
                table: "playground_runs",
                type: "jsonb",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "rendered_system_message",
                table: "playground_runs",
                type: "jsonb",
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "rendered_prompts", table: "playground_runs");

            migrationBuilder.DropColumn(name: "rendered_system_message", table: "playground_runs");
        }
    }
}
