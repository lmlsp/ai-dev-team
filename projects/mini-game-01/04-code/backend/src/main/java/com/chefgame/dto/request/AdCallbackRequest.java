package com.chefgame.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 广告回调 / 客户端上报请求
 */
@Data
public class AdCallbackRequest {

    /** 广告场景: energy / speedup / double_gold / extend_time */
    @NotBlank(message = "广告场景不能为空")
    private String scene;

    /** 广告平台: ylh / csj */
    @NotBlank(message = "广告平台不能为空")
    private String adPlatform;

    /** 广告平台返回的验证 token */
    private String adToken;

    /** 客户端时间戳 */
    private Long timestamp;

    /** 优量汇回调：交易ID */
    private String transId;

    /** 优量汇回调：appId */
    private String appId;

    /** 优量汇回调：签名 */
    private String sign;

    /** 优量汇回调：用户标识（用于 S2S 回调） */
    private String uid;
}
