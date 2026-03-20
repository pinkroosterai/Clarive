using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCostPerTokenFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AiProviderModel cost fields
            migrationBuilder.AddColumn<decimal>(
                name: "input_cost_per_million",
                table: "ai_provider_models",
                type: "numeric(18,6)",
                precision: 18,
                scale: 6,
                nullable: true
            );

            migrationBuilder.AddColumn<decimal>(
                name: "output_cost_per_million",
                table: "ai_provider_models",
                type: "numeric(18,6)",
                precision: 18,
                scale: 6,
                nullable: true
            );

            // AiUsageLog: replace estimated_cost_usd with split fields
            migrationBuilder.DropColumn(name: "estimated_cost_usd", table: "ai_usage_logs");

            migrationBuilder.AddColumn<decimal>(
                name: "estimated_input_cost_usd",
                table: "ai_usage_logs",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: true
            );

            migrationBuilder.AddColumn<decimal>(
                name: "estimated_output_cost_usd",
                table: "ai_usage_logs",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "input_cost_per_million",
                table: "ai_provider_models"
            );
            migrationBuilder.DropColumn(
                name: "output_cost_per_million",
                table: "ai_provider_models"
            );

            migrationBuilder.DropColumn(name: "estimated_input_cost_usd", table: "ai_usage_logs");
            migrationBuilder.DropColumn(name: "estimated_output_cost_usd", table: "ai_usage_logs");

            migrationBuilder.AddColumn<decimal>(
                name: "estimated_cost_usd",
                table: "ai_usage_logs",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: true
            );
        }
    }
}
