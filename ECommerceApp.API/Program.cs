using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ECommerceApp.API.Data;
using ECommerceApp.API.Services;
using Stripe;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register custom services
builder.Services.AddScoped<IPasswordHasher, PasswordHasher>();
builder.Services.AddScoped<ITokenService, ECommerceApp.API.Services.TokenService>();

// Get database connection string
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrEmpty(connectionString))
{
    throw new InvalidOperationException("No database connection string found.");
}

// Convert URI format to Npgsql connection string format if needed
string finalConnectionString;
try
{
    // Check if it's a URI format (starts with postgres:// or postgresql://)
    if (connectionString.StartsWith("postgres://") || connectionString.StartsWith("postgresql://"))
    {
        var uri = new Uri(connectionString);
        var userInfo = uri.UserInfo.Split(':');
        var username = userInfo[0];
        var password = userInfo.Length > 1 ? userInfo[1] : "";
        var host = uri.Host;
        var dbPort = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.TrimStart('/');

        finalConnectionString = $"Host={host};Port={dbPort};Database={database};Username={username};Password={password};SSL Mode=Prefer;Trust Server Certificate=true";
        
        Console.WriteLine($"Database connection configured: Host={host}, Database={database}");
    }
    else
    {
        // Already in Npgsql format
        finalConnectionString = connectionString;
        Console.WriteLine("Using standard Npgsql connection string format");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Connection string parsing failed: {ex.Message}");
    finalConnectionString = connectionString; // Fallback to original
}

// Add Entity Framework
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseNpgsql(finalConnectionString);
});

// Add JWT Authentication
// Read secret from environment variable first (Render uses JwtSettings__SecretKey). Fall back to configuration
// (useful for dotnet user-secrets during local development). Do not rely on appsettings.json for production secrets.
var secretKey = Environment.GetEnvironmentVariable("JwtSettings__SecretKey");
if (string.IsNullOrEmpty(secretKey))
{
    // Allow developer overrides (user-secrets) but warn when used
    secretKey = builder.Configuration["JwtSettings:SecretKey"];
    if (!string.IsNullOrEmpty(secretKey))
    {
        Console.WriteLine("Warning: Using JwtSettings:SecretKey from configuration (not recommended for production).\nConsider setting JwtSettings__SecretKey as an environment variable in your host.");
    }
}

if (string.IsNullOrEmpty(secretKey))
{
    throw new InvalidOperationException("JWT SecretKey not configured. Set environment variable JwtSettings__SecretKey or use dotnet user-secrets during development.");
}

var issuer = Environment.GetEnvironmentVariable("JwtSettings__Issuer") ?? builder.Configuration["JwtSettings:Issuer"] ?? "ECommerceApp";
var audience = Environment.GetEnvironmentVariable("JwtSettings__Audience") ?? builder.Configuration["JwtSettings:Audience"] ?? "ECommerceApp";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = issuer,
        ValidAudience = audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// Configure Stripe - require secret key from environment or configuration
var stripeSecretKey = Environment.GetEnvironmentVariable("Stripe__SecretKey")
    ?? builder.Configuration["Stripe:SecretKey"];

if (string.IsNullOrEmpty(stripeSecretKey))
{
    // Fail fast in production if Stripe secret is missing to avoid misuse or accidental exposure
    Console.WriteLine("ERROR: Stripe secret key is not configured. Set the Stripe__SecretKey environment variable or provide Stripe:SecretKey in configuration.");
    throw new InvalidOperationException("Stripe secret key not configured. Set Stripe__SecretKey environment variable.");
}

StripeConfiguration.ApiKey = stripeSecretKey;
Console.WriteLine("Stripe configured successfully (secret key loaded from environment/config)");

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins(
                "http://localhost:3000",
                "https://localhost:3000",
                "https://prn-assignment2-bvgu0vtls-le-dungs-projects-e1825efb.vercel.app"
            )
            .SetIsOriginAllowed(origin =>
            {
                // Allow any Vercel app domain
                return origin.Contains("vercel.app") ||
                       origin.StartsWith("http://localhost") ||
                       origin.StartsWith("https://localhost");
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
        });
});

var app = builder.Build();

// Apply database migrations automatically
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var context = services.GetRequiredService<ApplicationDbContext>();
    
    try
    {
        logger.LogInformation("Checking for pending database migrations...");
        
        // Get pending migrations
        var pendingMigrations = await context.Database.GetPendingMigrationsAsync();
        
        if (pendingMigrations.Any())
        {
            logger.LogInformation($"Found {pendingMigrations.Count()} pending migration(s)");
            foreach (var migration in pendingMigrations)
            {
                logger.LogInformation($"  - {migration}");
            }

            // For demo environment where data is not important, reset the schema
            // so migrations can be applied cleanly even if some objects already exist.
            try
            {
                logger.LogWarning("Pending migrations detected. Demo mode: resetting public schema to apply migrations cleanly.");

                // Drop and recreate the public schema (Postgres). This removes all objects.
                await context.Database.ExecuteSqlRawAsync("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

                logger.LogInformation("Schema reset completed. Applying migrations...");
                await context.Database.MigrateAsync();
                logger.LogInformation("All migrations applied successfully after schema reset!");
            }
            catch (Exception innerEx)
            {
                logger.LogError(innerEx, "Failed to reset schema or apply migrations: {Message}", innerEx.Message);
                // Attempt a normal migrate as a fallback
                try
                {
                    logger.LogInformation("Attempting standard migration as fallback...");
                    await context.Database.MigrateAsync();
                    logger.LogInformation("Migrations applied successfully (fallback)");
                }
                catch (Exception fallbackEx)
                {
                    logger.LogError(fallbackEx, "Fallback migration failed: {Message}", fallbackEx.Message);
                    throw; // let outer catch handle logging and continue start (app may still start)
                }
            }
        }
        else
        {
            logger.LogInformation("Database is up to date - no pending migrations");
        }
        
        // Log applied migrations
        var appliedMigrations = await context.Database.GetAppliedMigrationsAsync();
        logger.LogInformation($"Total applied migrations: {appliedMigrations.Count()}");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error during database migration: {Message}", ex.Message);
        logger.LogError("Application will continue but database operations may fail");
        // Don't throw - let the app start
    }
}

// Configure the HTTP request pipeline
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "ECommerce API V1");
    c.RoutePrefix = "swagger";
});

// Middleware pipeline
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Configure port
var port = Environment.GetEnvironmentVariable("PORT") ?? "80";
var urls = $"http://0.0.0.0:{port}";
app.Urls.Add(urls);

Console.WriteLine($"Application started successfully on {urls}");

app.Run();