package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 用户信息响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfoResponse {

    private String uid;
    private String nickName;
    private String avatarUrl;
    private Integer gold;
    private Integer energy;
    private BigDecimal rating;
    private Integer restaurantLevel;
    private String restaurantName;
    private Boolean isNewUser;
}
