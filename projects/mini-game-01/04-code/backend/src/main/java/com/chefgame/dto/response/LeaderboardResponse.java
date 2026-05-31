package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * 排行榜响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardResponse {

    /** 排行榜列表 */
    private List<RankItem> list;

    /** 我的排名 */
    private MyRank myRank;

    /** 总人数 */
    private Long total;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RankItem {
        private Integer rank;
        private String uid;
        private String nickName;
        private String avatarUrl;
        private String restaurantName;
        private Integer restaurantLevel;
        private BigDecimal rating;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MyRank {
        private Integer rank;
        private BigDecimal rating;
        private Integer restaurantLevel;
    }
}
