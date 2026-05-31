package com.chefgame.controller;

import com.chefgame.common.Result;
import com.chefgame.dto.request.ServeOrderRequest;
import com.chefgame.dto.response.OrderResponse;
import com.chefgame.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 订单 Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    /**
     * 获取当前订单队列
     * GET /api/v1/orders
     */
    @GetMapping
    public Result<OrderResponse> getOrders(@RequestAttribute("uid") String uid) {
        log.info("获取订单队列: uid={}", uid);
        OrderResponse orders = orderService.getOrders(uid);
        return Result.ok(orders);
    }

    /**
     * 上菜（关键操作）
     * POST /api/v1/orders/{orderId}/serve
     */
    @PostMapping("/{orderId}/serve")
    public Result<OrderResponse> serveOrder(
            @RequestAttribute("uid") String uid,
            @PathVariable String orderId,
            @Valid @RequestBody ServeOrderRequest request) {
        log.info("上菜请求: uid={}, orderId={}, recipe={}",
                uid, orderId, request.getServedItem().getT());
        OrderResponse response = orderService.serveOrder(uid, orderId, request);
        return Result.ok(response);
    }

    /**
     * 历史订单查询
     * GET /api/v1/orders/history
     */
    @GetMapping("/history")
    public Result<OrderResponse> getOrderHistory(
            @RequestAttribute("uid") String uid,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("查询历史订单: uid={}, page={}, size={}", uid, page, size);
        OrderResponse history = orderService.getOrderHistory(uid, page, size);
        return Result.ok(history);
    }
}
