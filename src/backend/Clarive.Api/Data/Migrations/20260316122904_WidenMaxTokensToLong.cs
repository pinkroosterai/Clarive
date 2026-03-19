using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class WidenMaxTokensToLong : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<long>(
                name: "max_output_tokens",
                table: "ai_provider_models",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true
            );

            migrationBuilder.AlterColumn<long>(
                name: "max_input_tokens",
                table: "ai_provider_models",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "max_output_tokens",
                table: "ai_provider_models",
                type: "integer",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true
            );

            migrationBuilder.AlterColumn<int>(
                name: "max_input_tokens",
                table: "ai_provider_models",
                type: "integer",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true
            );
        }
    }
}
