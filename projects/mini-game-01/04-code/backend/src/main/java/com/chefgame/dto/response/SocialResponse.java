package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * 社交相关响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialResponse {

    /** 好友列表 */
    private List<FriendBrief> friends;

    /** 好友餐厅信息 */
    private FriendRestaurant friendRestaurant;

    /** 拜访结果 */
    private VisitResult visitResult;

    /** 能量赠礼列表 */
    private List<EnergyGift> energyGifts;

    /** 当日拜访次数 */
    private Long dailyVisitCount;

    /** 当日拜访上限 */
    private Integer dailyVisitLimit;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FriendBrief {
        private String uid;
        private String nickName;
        private String avatarUrl;
        private Integer restaurantLevel;
        private String restaurantName;
        private BigDecimal rating;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FriendRestaurant {
        private String uid;
        private String nickName;
        private String restaurantName;
        private Integer level;
        private BigDecimal rating;
        private Long likeCount;
        private String cells;
        private Integer rows;
        private Integer cols;
        /** 今日是否已点赞 */
        private Boolean likedToday;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VisitResult {
        private Integer inspirationGained;
        private Boolean liked;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EnergyGift {
        private String fromUid;
        private String fromNickName;
        private Integer energyAmount;
        private Long sentAt;
    }
}
