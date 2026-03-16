using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SplitMaxContextSize : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "max_input_tokens",
                table: "ai_provider_models",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "max_output_tokens",
                table: "ai_provider_models",
                type: "integer",
                nullable: true);

            // Preserve existing data: copy max_context_size into max_input_tokens
            migrationBuilder.Sql("UPDATE ai_provider_models SET max_input_tokens = max_context_size");

            migrationBuilder.DropColumn(
                name: "max_context_size",
                table: "ai_provider_models");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "max_context_size",
                table: "ai_provider_models",
                type: "integer",
                nullable: false,
                defaultValue: 128000);

            migrationBuilder.Sql("UPDATE ai_provider_models SET max_context_size = COALESCE(max_input_tokens, 128000)");

            migrationBuilder.DropColumn(
                name: "max_input_tokens",
                table: "ai_provider_models");

            migrationBuilder.DropColumn(
                name: "max_output_tokens",
                table: "ai_provider_models");
        }
    }
}
