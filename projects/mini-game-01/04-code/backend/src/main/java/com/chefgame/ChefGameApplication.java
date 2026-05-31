package com.chefgame;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 合合小厨神 - 游戏后端启动类
 */
@EnableScheduling
@SpringBootApplication
public class ChefGameApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChefGameApplication.class, args);
    }
}
