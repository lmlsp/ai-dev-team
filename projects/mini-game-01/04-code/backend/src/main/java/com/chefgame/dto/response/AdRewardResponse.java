package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 广告奖励响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdRewardResponse {

    /** 奖励详情 */
    private RewardDetail reward;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RewardDetail {
        /** 奖励类型 */
        private String type;
        /** 奖励数量 */
        private Integer amount;
        /** 当日已看次数 */
        private Long dailyCount;
        /** 当日上限 */
        private Integer dailyLimit;
    }
}
