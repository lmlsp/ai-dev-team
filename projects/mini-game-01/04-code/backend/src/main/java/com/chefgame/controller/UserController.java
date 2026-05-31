package com.chefgame.controller;

import com.chefgame.common.Result;
import com.chefgame.dto.request.LoginRequest;
import com.chefgame.dto.response.LoginResponse;
import com.chefgame.dto.response.UserInfoResponse;
import com.chefgame.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 用户 Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * 微信静默登录
     * POST /api/v1/auth/login
     */
    @PostMapping("/auth/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        log.info("登录请求: nickName={}", request.getNickName());
        LoginResponse response = userService.login(request);
        return Result.ok(response);
    }

    /**
     * 获取当前用户信息
     * GET /api/v1/users/me
     */
    @GetMapping("/users/me")
    public Result<UserInfoResponse> getUserInfo(@RequestAttribute("uid") String uid) {
        log.info("查询用户信息: uid={}", uid);
        UserInfoResponse info = userService.getUserInfo(uid);
        return Result.ok(info);
    }

    /**
     * 更新用户信息（昵称、头像）
     * PUT /api/v1/users/me
     */
    @PutMapping("/users/me")
    public Result<UserInfoResponse> updateUserInfo(
            @RequestAttribute("uid") String uid,
            @RequestBody Map<String, String> body) {
        String nickName = body.get("nickName");
        String avatarUrl = body.get("avatarUrl");
        log.info("更新用户信息: uid={}", uid);
        UserInfoResponse info = userService.updateUserInfo(uid, nickName, avatarUrl);
        return Result.ok(info);
    }
}
