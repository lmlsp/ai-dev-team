package com.chefgame.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 微信登录请求
 */
@Data
public class LoginRequest {
    /** wx.login() 返回的 code */
    @NotBlank(message = "登录凭证不能为空")
    private String code;

    /** 用户昵称（可选，首次注册时） */
    private String nickName;

    /** 用户头像URL（可选） */
    private String avatarUrl;
}
