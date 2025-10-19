using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;
using ECommerceApp.API.Data;
using System.Security.Claims;

namespace ECommerceApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PaymentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PaymentController> _logger;

    public PaymentController(ApplicationDbContext context, ILogger<PaymentController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost("create-payment-intent")]
    public async Task<IActionResult> CreatePaymentIntent()
    {
        try
        {
            var userEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(userEmail))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == userEmail);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Get user's cart
            var cart = await _context.Carts
                .Include(c => c.CartItems)
                .ThenInclude(ci => ci.Product)
                .FirstOrDefaultAsync(c => c.UserId == user.Id);

            if (cart == null || cart.CartItems == null || !cart.CartItems.Any())
            {
                return BadRequest(new { message = "Cart is empty" });
            }

            // Calculate total amount in cents (Stripe requires smallest currency unit)
            var totalAmount = cart.CartItems.Sum(item => item.Quantity * item.Product.Price);
            var amountInCents = (long)(totalAmount * 100);

            // Create Stripe PaymentIntent
            var options = new PaymentIntentCreateOptions
            {
                Amount = amountInCents,
                Currency = "usd",
                // Only allow card payments (remove AutomaticPaymentMethods when specifying PaymentMethodTypes)
                PaymentMethodTypes = new List<string> { "card" },
                Metadata = new Dictionary<string, string>
                {
                    { "user_id", user.Id.ToString() },
                    { "user_email", user.Email },
                    { "cart_id", cart.Id.ToString() }
                }
            };

            var service = new PaymentIntentService();
            var paymentIntent = await service.CreateAsync(options);

            _logger.LogInformation($"Payment intent created for user {userEmail}: {paymentIntent.Id}");

            return Ok(new
            {
                clientSecret = paymentIntent.ClientSecret,
                paymentIntentId = paymentIntent.Id,
                amount = totalAmount,
                currency = "usd"
            });
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe error creating payment intent");
            return StatusCode(500, new { message = "Payment service error", error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating payment intent");
            return StatusCode(500, new { message = "An error occurred while processing payment" });
        }
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> StripeWebhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        
        try
        {
            var webhookSecret = Environment.GetEnvironmentVariable("Stripe__WebhookSecret");
            var stripeEvent = EventUtility.ConstructEvent(
                json,
                Request.Headers["Stripe-Signature"],
                webhookSecret
            );

            _logger.LogInformation($"Stripe webhook received: {stripeEvent.Type}");

            if (stripeEvent.Type == "payment_intent.succeeded")
            {
                var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
                if (paymentIntent != null)
                {
                    _logger.LogInformation($"Payment succeeded for intent: {paymentIntent.Id}");
                    
                    // Find order by payment intent ID and mark as paid
                    var order = await _context.Orders
                        .Where(o => o.PaymentIntentId == paymentIntent.Id)
                        .FirstOrDefaultAsync();

                    if (order != null)
                    {
                        order.Status = "paid";
                        order.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                        _logger.LogInformation($"Order {order.Id} marked as paid via webhook");
                    }
                    else
                    {
                        _logger.LogWarning($"No order found for payment intent: {paymentIntent.Id}");
                    }
                }
            }

            return Ok();
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe webhook error");
            return BadRequest();
        }
    }
}
