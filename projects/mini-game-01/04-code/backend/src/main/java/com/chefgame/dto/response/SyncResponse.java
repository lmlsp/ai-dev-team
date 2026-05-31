package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * 棋盘同步响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncResponse {

    /** 是否接受 */
    private Boolean accepted;

    /** 新版本号 */
    private Integer newVersion;

    /** 服务端校验后的金币 */
    private Integer serverGold;

    /** 服务端校验后的能量 */
    private Integer serverEnergy;

    /** 服务端校验后的好评度 */
    private BigDecimal serverRating;

    /** 差异校正列表（如有差异，返回服务端正确值） */
    private List<Correction> corrections;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Correction {
        private String field;
        private Object clientValue;
        private Object serverValue;
    }
}
