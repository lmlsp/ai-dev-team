package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 棋盘状态响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardResponse {

    /** 棋盘完整数据 */
    private String cells;

    /** 棋盘行数 */
    private Integer rows;

    /** 棋盘列数 */
    private Integer cols;

    /** 当前版本号 */
    private Integer version;

    /** 用户金币 */
    private Integer gold;

    /** 用户能量 */
    private Integer energy;

    /** 好评度 */
    private java.math.BigDecimal rating;

    /** 餐厅等级 */
    private Integer restaurantLevel;
}
