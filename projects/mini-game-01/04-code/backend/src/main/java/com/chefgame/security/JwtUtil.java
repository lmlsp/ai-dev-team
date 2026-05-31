package com.chefgame.security;

import cn.hutool.jwt.JWT;
import cn.hutool.jwt.JWTUtil;
import cn.hutool.jwt.signers.JWTSigner;
import cn.hutool.jwt.signers.JWTSignerUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * JWT 工具类 — 使用 hutool-jwt 签发和校验
 */
@Slf4j
@Component
public class JwtUtil {

    private final byte[] secretKey;
    private final long expiration;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expiration}") long expiration) {
        this.secretKey = secret.getBytes(StandardCharsets.UTF_8);
        this.expiration = expiration;
    }

    /**
     * 签发 JWT token
     * @param uid 用户UID
     * @return token 字符串
     */
    public String createToken(String uid) {
        long now = System.currentTimeMillis();
        long exp = now + expiration;

        Map<String, Object> payload = Map.of(
                "sub", uid,
                "iat", now,
                "exp", exp
        );

        JWTSigner signer = JWTSignerUtil.hs256(secretKey);
        return JWTUtil.createToken(payload, signer);
    }

    /**
     * 校验并解析 token，返回用户 UID
     * @param token JWT token
     * @return 用户UID，token无效返回null
     */
    public String parseToken(String token) {
        try {
            JWTSigner signer = JWTSignerUtil.hs256(secretKey);
            if (!JWTUtil.verify(token, signer)) {
                log.warn("JWT 签名验证失败");
                return null;
            }

            JWT jwt = JWTUtil.parseToken(token);
            // 校验是否过期
            Long exp = jwt.getPayload().getLong("exp");
            if (exp == null || exp < System.currentTimeMillis()) {
                log.warn("JWT 已过期");
                return null;
            }

            return jwt.getPayload().getStr("sub");
        } catch (Exception e) {
            log.warn("JWT 解析失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 刷新 token
     */
    public String refreshToken(String uid) {
        return createToken(uid);
    }
}
