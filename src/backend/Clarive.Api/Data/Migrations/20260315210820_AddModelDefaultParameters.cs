using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddModelDefaultParameters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "default_max_tokens",
                table: "ai_provider_models",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "default_reasoning_effort",
                table: "ai_provider_models",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "default_temperature",
                table: "ai_provider_models",
                type: "real",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "default_max_tokens",
                table: "ai_provider_models");

            migrationBuilder.DropColumn(
                name: "default_reasoning_effort",
                table: "ai_provider_models");

            migrationBuilder.DropColumn(
                name: "default_temperature",
                table: "ai_provider_models");
        }
    }
}
