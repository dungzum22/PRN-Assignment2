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
    public class OrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<OrdersController> _logger;

        public OrdersController(ApplicationDbContext context, ILogger<OrdersController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int GetUserId()
        {
            var userIdClaim = User.FindFirst("userId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
            return int.Parse(userIdClaim?.Value ?? "0");
        }

        // GET: api/orders
        [HttpGet]
        public async Task<ActionResult<IEnumerable<OrderDto>>> GetOrders()
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var orders = await _context.Orders
                    .Include(o => o.OrderItems)
                    .Where(o => o.UserId == userId)
                    .OrderByDescending(o => o.CreatedAt)
                    .ToListAsync();

                var orderDtos = orders.Select(o => new OrderDto
                {
                    Id = o.Id,
                    UserId = o.UserId,
                    TotalAmount = o.TotalAmount,
                    Status = o.Status,
                    PaymentMethod = o.PaymentMethod,
                    PaymentIntentId = o.PaymentIntentId,
                    CreatedAt = o.CreatedAt,
                    Items = o.OrderItems.Select(oi => new OrderItemDto
                    {
                        Id = oi.Id,
                        ProductId = oi.ProductId,
                        ProductName = oi.ProductName,
                        Price = oi.Price,
                        Quantity = oi.Quantity,
                        Subtotal = oi.Price * oi.Quantity
                    }).ToList()
                }).ToList();

                return Ok(orderDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching orders");
                return StatusCode(500, new { message = "Error fetching orders" });
            }
        }

        // GET: api/orders/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<OrderDto>> GetOrder(int id)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var order = await _context.Orders
                    .Include(o => o.OrderItems)
                    .FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId);

                if (order == null)
                {
                    return NotFound(new { message = "Order not found" });
                }

                var orderDto = new OrderDto
                {
                    Id = order.Id,
                    UserId = order.UserId,
                    TotalAmount = order.TotalAmount,
                    Status = order.Status,
                    PaymentMethod = order.PaymentMethod,
                    PaymentIntentId = order.PaymentIntentId,
                    CreatedAt = order.CreatedAt,
                    Items = order.OrderItems.Select(oi => new OrderItemDto
                    {
                        Id = oi.Id,
                        ProductId = oi.ProductId,
                        ProductName = oi.ProductName,
                        Price = oi.Price,
                        Quantity = oi.Quantity,
                        Subtotal = oi.Price * oi.Quantity
                    }).ToList()
                };

                return Ok(orderDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching order");
                return StatusCode(500, new { message = "Error fetching order" });
            }
        }

        // POST: api/orders
        [HttpPost]
        public async Task<ActionResult<OrderDto>> CreateOrder(CreateOrderDto dto)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                // Get user's cart
                var cart = await _context.Carts
                    .Include(c => c.CartItems)
                    .ThenInclude(ci => ci.Product)
                    .FirstOrDefaultAsync(c => c.UserId == userId);

                if (cart == null || !cart.CartItems.Any())
                {
                    return BadRequest(new { message = "Cart is empty" });
                }

                // Calculate total
                var totalAmount = cart.CartItems.Sum(ci => ci.Product.Price * ci.Quantity);

                // Validate payment method
                var paymentMethod = dto.PaymentMethod?.ToLower() ?? "cash";
                if (paymentMethod != "cash" && paymentMethod != "stripe")
                {
                    return BadRequest(new { message = "Invalid payment method. Must be 'cash' or 'stripe'" });
                }

                // Create order
                var order = new Order
                {
                    UserId = userId,
                    TotalAmount = totalAmount,
                    Status = "pending", // Will be updated to "paid" by webhook for Stripe
                    PaymentMethod = paymentMethod,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Orders.Add(order);
                await _context.SaveChangesAsync();

                // Create order items from cart items
                foreach (var cartItem in cart.CartItems)
                {
                    var orderItem = new OrderItem
                    {
                        OrderId = order.Id,
                        ProductId = cartItem.ProductId,
                        ProductName = cartItem.Product.Name,
                        Price = cartItem.Product.Price,
                        Quantity = cartItem.Quantity
                    };
                    _context.OrderItems.Add(orderItem);
                }

                await _context.SaveChangesAsync();

                // Clear cart
                _context.CartItems.RemoveRange(cart.CartItems);
                cart.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Reload order with items
                var createdOrder = await _context.Orders
                    .Include(o => o.OrderItems)
                    .FirstAsync(o => o.Id == order.Id);

                var orderDto = new OrderDto
                {
                    Id = createdOrder.Id,
                    UserId = createdOrder.UserId,
                    TotalAmount = createdOrder.TotalAmount,
                    Status = createdOrder.Status,
                    PaymentMethod = createdOrder.PaymentMethod,
                    PaymentIntentId = createdOrder.PaymentIntentId,
                    CreatedAt = createdOrder.CreatedAt,
                    Items = createdOrder.OrderItems.Select(oi => new OrderItemDto
                    {
                        Id = oi.Id,
                        ProductId = oi.ProductId,
                        ProductName = oi.ProductName,
                        Price = oi.Price,
                        Quantity = oi.Quantity,
                        Subtotal = oi.Price * oi.Quantity
                    }).ToList()
                };

                return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, orderDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating order");
                return StatusCode(500, new { message = "Error creating order" });
            }
        }

        // PUT: api/orders/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateOrder(int id, [FromBody] UpdateOrderDto dto)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var order = await _context.Orders
                    .FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId);

                if (order == null)
                {
                    return NotFound(new { message = "Order not found" });
                }

                if (!string.IsNullOrEmpty(dto.PaymentIntentId))
                {
                    order.PaymentIntentId = dto.PaymentIntentId;
                }

                order.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating order");
                return StatusCode(500, new { message = "Error updating order" });
            }
        }

        // PUT: api/orders/{id}/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] string status)
        {
            try
            {
                var userId = GetUserId();
                if (userId == 0)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var order = await _context.Orders
                    .FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId);

                if (order == null)
                {
                    return NotFound(new { message = "Order not found" });
                }

                // Validate status
                var validStatuses = new[] { "pending", "paid", "shipped", "delivered", "cancelled" };
                if (!validStatuses.Contains(status.ToLower()))
                {
                    return BadRequest(new { message = "Invalid status" });
                }

                order.Status = status.ToLower();
                order.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating order status");
                return StatusCode(500, new { message = "Error updating order status" });
            }
        }
    }
}
