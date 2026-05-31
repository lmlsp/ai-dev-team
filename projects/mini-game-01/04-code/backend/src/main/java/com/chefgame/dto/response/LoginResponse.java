package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 登录响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    /** JWT token */
    private String token;

    /** 用户信息 */
    private UserBrief user;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserBrief {
        private String uid;
        private String nickName;
        private String avatarUrl;
        private Boolean isNewUser;
        private Integer gold;
        private Integer energy;
        private Integer restaurantLevel;
        private BigDecimal rating;
    }
}
