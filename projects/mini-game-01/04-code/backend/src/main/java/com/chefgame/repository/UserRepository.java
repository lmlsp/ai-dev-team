package com.chefgame.repository;

import com.chefgame.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 用户 Repository
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUid(String uid);

    Optional<User> findByOpenid(String openid);

    List<User> findByUidIn(List<String> uids);

    @Query("SELECT u.gold FROM User u WHERE u.uid = :uid")
    Integer getGold(@Param("uid") String uid);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.energy = :energy, u.energyTs = :energyTs WHERE u.uid = :uid")
    int updateEnergy(@Param("uid") String uid,
                     @Param("energy") Integer energy,
                     @Param("energyTs") Long energyTs);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.gold = :gold WHERE u.uid = :uid")
    int updateGold(@Param("uid") String uid, @Param("gold") Integer gold);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.rating = :rating WHERE u.uid = :uid")
    int updateRating(@Param("uid") String uid, @Param("rating") java.math.BigDecimal rating);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.restaurantLevel = :level WHERE u.uid = :uid")
    int updateRestaurantLevel(@Param("uid") String uid, @Param("level") Integer level);
}
