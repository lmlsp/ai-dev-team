package com.chefgame.controller;

import com.chefgame.common.Result;
import com.chefgame.dto.response.RestaurantResponse;
import com.chefgame.service.RestaurantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 餐厅 Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/restaurant")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurantService;

    /**
     * 获取餐厅当前状态及升级条件
     * GET /api/v1/restaurant
     */
    @GetMapping
    public Result<RestaurantResponse> getRestaurant(@RequestAttribute("uid") String uid) {
        log.info("查询餐厅状态: uid={}", uid);
        RestaurantResponse response = restaurantService.getRestaurant(uid);
        return Result.ok(response);
    }

    /**
     * 升级餐厅
     * POST /api/v1/restaurant/upgrade
     */
    @PostMapping("/upgrade")
    public Result<RestaurantResponse> upgrade(@RequestAttribute("uid") String uid) {
        log.info("升级餐厅请求: uid={}", uid);
        RestaurantResponse response = restaurantService.upgrade(uid);
        return Result.ok(response);
    }
}
