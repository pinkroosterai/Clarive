using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddApiKeyExpiry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "expires_at",
                table: "api_keys",
                type: "timestamp with time zone",
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "expires_at", table: "api_keys");
        }
    }
}
