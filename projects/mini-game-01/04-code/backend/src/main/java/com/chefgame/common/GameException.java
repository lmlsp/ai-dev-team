package com.chefgame.common;

import lombok.Getter;

/**
 * 业务异常
 */
@Getter
public class GameException extends RuntimeException {
    /** 错误码 */
    private final int code;

    public GameException(int code, String message) {
        super(message);
        this.code = code;
    }

    public GameException(String message) {
        super(message);
        this.code = 30000;
    }
}
