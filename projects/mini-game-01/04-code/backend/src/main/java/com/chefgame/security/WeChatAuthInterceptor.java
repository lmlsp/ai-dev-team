package com.chefgame.security;

import com.chefgame.common.GameException;
import com.chefgame.common.Result;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

/**
 * JWT Token 校验拦截器
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeChatAuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    /** 白名单路径 */
    private static final Set<String> WHITE_LIST = Set.of(
            "/api/v1/auth/login",
            "/api/v1/ad/callback/ylh",
            "/api/v1/share"
    );

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {
        // 预检请求放行
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();

        // 白名单放行
        for (String whitePath : WHITE_LIST) {
            if (path.startsWith(whitePath)) {
                return true;
            }
        }

        // Token 校验
        String token = request.getHeader("Authorization");
        if (token == null || token.isBlank()) {
            log.warn("缺少 Authorization 头: path={}", path);
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(objectMapper.writeValueAsString(
                    Result.fail(10003, "请先登录")));
            return false;
        }

        // 去掉 Bearer 前缀
        String jwt = token.startsWith("Bearer ") ? token.substring(7) : token;

        try {
            String uid = jwtUtil.parseToken(jwt);
            if (uid == null) {
                log.warn("Token 解析失败: path={}", path);
                response.setStatus(HttpStatus.UNAUTHORIZED.value());
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(objectMapper.writeValueAsString(
                        Result.fail(10003, "登录已过期，请重新登录")));
                return false;
            }
            // 将 uid 存入 request attribute，供 Controller 使用
            request.setAttribute("uid", uid);
        } catch (Exception e) {
            log.warn("Token 校验异常: path={}, error={}", path, e.getMessage());
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(objectMapper.writeValueAsString(
                    Result.fail(10003, "登录已过期，请重新登录")));
            return false;
        }

        return true;
    }
}
