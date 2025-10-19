using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ECommerceApp.API.Data;
using ECommerceApp.API.Models;
using ECommerceApp.API.DTOs;
using System.Security.Claims;

namespace ECommerceApp.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CartController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CartController> _logger;

        public CartController(ApplicationDbContext context, ILogger<CartController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int GetUserId()
        {
            var userIdClaim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
            return int.Parse(userIdClaim?.Value ?? "0");
        }

        private async Task<Cart> GetOrCreateCartAsync(int userId)
        {
            var cart = await _context.Carts
                .Include(c => c.CartItems)
                .ThenInclude(ci => ci.Product)
                .FirstOrDefaultAsync(c => c.UserId == userId);

            if (cart == null)
            {
                cart = new Cart
                {
                    UserId = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Carts.Add(cart);
                await _context.SaveChangesAsync();
            }

            return cart;
        }

        // GET: api/cart
        [HttpGet]
        public async Task<ActionResult<CartDto>> GetCart()
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var cart = await GetOrCreateCartAsync(userId);

                var cartDto = new CartDto
                {
                    Id = cart.Id,
                    UserId = cart.UserId,
                    Items = cart.CartItems.Select(ci => new CartItemDto
                    {
                        Id = ci.Id,
                        ProductId = ci.ProductId,
                        ProductName = ci.Product.Name,
                        ProductDescription = ci.Product.Description,
                        Price = ci.Product.Price,
                        ImageUrl = ci.Product.ImageUrl,
                        Quantity = ci.Quantity,
                        Subtotal = ci.Product.Price * ci.Quantity
                    }).ToList(),
                    TotalAmount = cart.CartItems.Sum(ci => ci.Product.Price * ci.Quantity)
                };

                return Ok(cartDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching cart");
                return StatusCode(500, new { message = "Error fetching cart" });
            }
        }

        // POST: api/cart/items
        [HttpPost("items")]
        public async Task<ActionResult<CartDto>> AddToCart(AddToCartDto dto)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                // Validate product exists
                var product = await _context.Products.FindAsync(dto.ProductId);
                if (product == null)
                {
                    return NotFound(new { message = "Product not found" });
                }

                if (dto.Quantity <= 0)
                {
                    return BadRequest(new { message = "Quantity must be greater than 0" });
                }

                var cart = await GetOrCreateCartAsync(userId);

                // Check if item already exists in cart
                var existingItem = cart.CartItems.FirstOrDefault(ci => ci.ProductId == dto.ProductId);
                if (existingItem != null)
                {
                    existingItem.Quantity += dto.Quantity;
                }
                else
                {
                    var cartItem = new CartItem
                    {
                        CartId = cart.Id,
                        ProductId = dto.ProductId,
                        Quantity = dto.Quantity,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.CartItems.Add(cartItem);
                }

                cart.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Return updated cart
                return await GetCart();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding item to cart");
                return StatusCode(500, new { message = "Error adding item to cart" });
            }
        }

        // PUT: api/cart/items/{id}
        [HttpPut("items/{id}")]
        public async Task<ActionResult<CartDto>> UpdateCartItem(int id, UpdateCartItemDto dto)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var cartItem = await _context.CartItems
                    .Include(ci => ci.Cart)
                    .FirstOrDefaultAsync(ci => ci.Id == id && ci.Cart.UserId == userId);

                if (cartItem == null)
                {
                    return NotFound(new { message = "Cart item not found" });
                }

                if (dto.Quantity <= 0)
                {
                    return BadRequest(new { message = "Quantity must be greater than 0" });
                }

                cartItem.Quantity = dto.Quantity;
                cartItem.Cart.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return await GetCart();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating cart item");
                return StatusCode(500, new { message = "Error updating cart item" });
            }
        }

        // DELETE: api/cart/items/{id}
        [HttpDelete("items/{id}")]
        public async Task<ActionResult<CartDto>> RemoveFromCart(int id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var cartItem = await _context.CartItems
                    .Include(ci => ci.Cart)
                    .FirstOrDefaultAsync(ci => ci.Id == id && ci.Cart.UserId == userId);

                if (cartItem == null)
                {
                    return NotFound(new { message = "Cart item not found" });
                }

                _context.CartItems.Remove(cartItem);
                cartItem.Cart.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return await GetCart();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing item from cart");
                return StatusCode(500, new { message = "Error removing item from cart" });
            }
        }

        // DELETE: api/cart/clear
        [HttpDelete("clear")]
        public async Task<IActionResult> ClearCart()
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var cart = await _context.Carts
                    .Include(c => c.CartItems)
                    .FirstOrDefaultAsync(c => c.UserId == userId);

                if (cart != null)
                {
                    _context.CartItems.RemoveRange(cart.CartItems);
                    cart.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing cart");
                return StatusCode(500, new { message = "Error clearing cart" });
            }
        }
    }
}
