using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddApiKeyUsageTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "last_used_at",
                table: "api_keys",
                type: "timestamp with time zone",
                nullable: true
            );

            migrationBuilder.AddColumn<long>(
                name: "usage_count",
                table: "api_keys",
                type: "bigint",
                nullable: false,
                defaultValue: 0L
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "last_used_at", table: "api_keys");

            migrationBuilder.DropColumn(name: "usage_count", table: "api_keys");
        }
    }
}
