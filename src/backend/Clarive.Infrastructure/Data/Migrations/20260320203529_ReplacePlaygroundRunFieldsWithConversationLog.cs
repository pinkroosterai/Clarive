using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReplacePlaygroundRunFieldsWithConversationLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "mcp_server_ids",
                table: "playground_runs");

            migrationBuilder.DropColumn(
                name: "reasoning",
                table: "playground_runs");

            migrationBuilder.DropColumn(
                name: "rendered_prompts",
                table: "playground_runs");

            migrationBuilder.DropColumn(
                name: "rendered_system_message",
                table: "playground_runs");

            migrationBuilder.DropColumn(
                name: "responses",
                table: "playground_runs");

            migrationBuilder.RenameColumn(
                name: "JudgeScores",
                table: "playground_runs",
                newName: "judge_scores");

            migrationBuilder.RenameColumn(
                name: "tool_invocations",
                table: "playground_runs",
                newName: "conversation_log");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "judge_scores",
                table: "playground_runs",
                newName: "JudgeScores");

            migrationBuilder.RenameColumn(
                name: "conversation_log",
                table: "playground_runs",
                newName: "tool_invocations");

            migrationBuilder.AddColumn<string>(
                name: "mcp_server_ids",
                table: "playground_runs",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reasoning",
                table: "playground_runs",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rendered_prompts",
                table: "playground_runs",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rendered_system_message",
                table: "playground_runs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "responses",
                table: "playground_runs",
                type: "jsonb",
                nullable: false,
                defaultValue: "");
        }
    }
}
