import React, { useState, useEffect } from 'react';
import { 
  FiGift, FiStar, FiAward, FiTarget, FiZap,
  FiTrendingUp, FiUsers, FiShoppingBag, FiHeart,
  FiCheckCircle, FiClock, FiLock, FiUnlock,
  FiX, FiShield, FiFlag
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const LoyaltyRewards = ({ isOpen, onClose }) => {
  const [userLevel, setUserLevel] = useState({
    current: 'Platinum',
    points: 2847,
    nextLevel: 'Diamond',
    pointsToNext: 1153,
    progress: 71
  });

  const [achievements, setAchievements] = useState([
    {
      id: 1,
      title: 'First Purchase',
      description: 'Made your first purchase',
      icon: '🛍️',
      points: 100,
      unlocked: true,
      unlockedAt: '2023-01-15',
      rarity: 'common'
    },
    {
      id: 2,
      title: 'Loyal Customer',
      description: 'Made 10+ purchases',
      icon: '💎',
      points: 500,
      unlocked: true,
      unlockedAt: '2023-06-20',
      rarity: 'rare'
    },
    {
      id: 3,
      title: 'Big Spender',
      description: 'Spent over $10,000',
      icon: '💰',
      points: 1000,
      unlocked: true,
      unlockedAt: '2023-11-15',
      rarity: 'epic'
    },
    {
      id: 4,
      title: 'Review Master',
      description: 'Left 25+ reviews',
      icon: '⭐',
      points: 750,
      unlocked: false,
      progress: 12,
      target: 25,
      rarity: 'rare'
    },
    {
      id: 5,
      title: 'Social Butterfly',
      description: 'Shared 10 products',
      icon: '🦋',
      points: 300,
      unlocked: false,
      progress: 3,
      target: 10,
      rarity: 'common'
    },
    {
      id: 6,
      title: 'VIP Member',
      description: 'Reach Diamond level',
      icon: '👑',
      points: 2000,
      unlocked: false,
      progress: 71,
      target: 100,
      rarity: 'legendary'
    }
  ]);

  const [rewards, setRewards] = useState([
    {
      id: 1,
      title: 'Free Shipping',
      description: 'Free delivery on all orders',
      cost: 500,
      available: true,
      icon: '🚚',
      category: 'shipping'
    },
    {
      id: 2,
      title: '10% Discount',
      description: '10% off your next purchase',
      cost: 1000,
      available: true,
      icon: '🎯',
      category: 'discount'
    },
    {
      id: 3,
      title: 'Premium Support',
      description: 'Priority customer support',
      cost: 750,
      available: true,
      icon: '🎧',
      category: 'service'
    },
    {
      id: 4,
      title: 'Exclusive Access',
      description: 'Early access to new products',
      cost: 1500,
      available: true,
      icon: '🔮',
      category: 'exclusive'
    },
    {
      id: 5,
      title: 'Gift Card $25',
      description: '$25 FareDeal gift card',
      cost: 2500,
      available: true,
      icon: '💳',
      category: 'gift'
    },
    {
      id: 6,
      title: 'VIP Experience',
      description: 'Personal shopping assistant',
      cost: 5000,
      available: false,
      icon: '👑',
      category: 'vip'
    }
  ]);

  const [dailyChallenges, setDailyChallenges] = useState([
    {
      id: 1,
      title: 'Daily Login',
      description: 'Visit FareDeal today',
      points: 50,
      completed: true,
      icon: '📅'
    },
    {
      id: 2,
      title: 'Browse Products',
      description: 'View 5 different products',
      points: 100,
      completed: false,
      progress: 3,
      target: 5,
      icon: '👀'
    },
    {
      id: 3,
      title: 'Add to Wishlist',
      description: 'Add 2 items to your wishlist',
      points: 75,
      completed: false,
      progress: 1,
      target: 2,
      icon: '❤️'
    }
  ]);

  const [weeklyChallenges, setWeeklyChallenges] = useState([
    {
      id: 1,
      title: 'Weekly Shopper',
      description: 'Make a purchase this week',
      points: 200,
      completed: false,
      icon: '🛒'
    },
    {
      id: 2,
      title: 'Review Writer',
      description: 'Write 3 product reviews',
      points: 300,
      completed: false,
      progress: 1,
      target: 3,
      icon: '✍️'
    }
  ]);

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return 'from-gray-400 to-gray-600';
      case 'rare': return 'from-blue-400 to-blue-600';
      case 'epic': return 'from-purple-400 to-purple-600';
      case 'legendary': return 'from-yellow-400 to-orange-500';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getRarityIcon = (rarity) => {
    switch (rarity) {
      case 'common': return '🥉';
      case 'rare': return '🥈';
      case 'epic': return '🥇';
      case 'legendary': return '💎';
      default: return '🏅';
    }
  };

  const handleRedeemReward = (reward) => {
    if (userLevel.points >= reward.cost) {
      toast.success(`🎉 ${reward.title} redeemed successfully!`);
      setUserLevel(prev => ({
        ...prev,
        points: prev.points - reward.cost
      }));
    } else {
      toast.error(`You need ${reward.cost - userLevel.points} more points to redeem this reward.`);
    }
  };

  const handleClaimAchievement = (achievement) => {
    if (achievement.unlocked) {
      toast.success(`🏆 Achievement "${achievement.title}" claimed! +${achievement.points} points`);
      setUserLevel(prev => ({
        ...prev,
        points: prev.points + achievement.points
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">🎯 Loyalty Rewards</h2>
              <p className="text-purple-100">Earn points, unlock achievements, and redeem exclusive rewards!</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <FiX className="h-8 w-8" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* User Level Progress */}
          <div className="p-6 border-b border-gray-200">
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="text-4xl">👑</div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{userLevel.current} Member</h3>
                    <p className="text-gray-600">Next: {userLevel.nextLevel}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{userLevel.points.toLocaleString()}</div>
                  <div className="text-gray-600">Points</div>
                </div>
              </div>
              
              <div className="mb-2">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress to {userLevel.nextLevel}</span>
                  <span>{userLevel.pointsToNext} points to go</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${userLevel.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Achievements */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <FiAward className="h-6 w-6 text-yellow-500" />
                <span>Achievements</span>
              </h3>
              <div className="space-y-3">
                {achievements.map(achievement => (
                  <div 
                    key={achievement.id}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      achievement.unlocked 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{achievement.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-bold text-gray-900">{achievement.title}</h4>
                          <span className="text-sm">{getRarityIcon(achievement.rarity)}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                        
                        {achievement.unlocked ? (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-green-600 font-medium">
                              ✅ Unlocked +{achievement.points} points
                            </div>
                            <button
                              onClick={() => handleClaimAchievement(achievement)}
                              className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600 transition-colors"
                            >
                              Claim
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                              Progress: {achievement.progress}/{achievement.target}
                            </div>
                            <div className="text-sm font-medium text-gray-600">
                              +{achievement.points} points
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rewards */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <FiGift className="h-6 w-6 text-purple-500" />
                <span>Rewards</span>
              </h3>
              <div className="space-y-3">
                {rewards.map(reward => (
                  <div 
                    key={reward.id}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      reward.available 
                        ? 'border-purple-200 bg-purple-50' 
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{reward.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-bold text-gray-900">{reward.title}</h4>
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
                            {reward.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{reward.description}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-600">
                            {reward.cost} points
                          </div>
                          <button
                            onClick={() => handleRedeemReward(reward)}
                            disabled={!reward.available || userLevel.points < reward.cost}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              reward.available && userLevel.points >= reward.cost
                                ? 'bg-purple-500 text-white hover:bg-purple-600'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {reward.available ? 'Redeem' : 'Locked'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Challenges */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Daily Challenges */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <FiTarget className="h-6 w-6 text-blue-500" />
                  <span>Daily Challenges</span>
                </h3>
                <div className="space-y-3">
                  {dailyChallenges.map(challenge => (
                    <div 
                      key={challenge.id}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        challenge.completed 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-blue-200 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{challenge.icon}</div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{challenge.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>
                          
                          {challenge.completed ? (
                            <div className="text-sm text-green-600 font-medium">
                              ✅ Completed +{challenge.points} points
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-gray-500">
                                Progress: {challenge.progress}/{challenge.target}
                              </div>
                              <div className="text-sm font-medium text-blue-600">
                                +{challenge.points} points
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Challenges */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <FiTrendingUp className="h-6 w-6 text-green-500" />
                  <span>Weekly Challenges</span>
                </h3>
                <div className="space-y-3">
                  {weeklyChallenges.map(challenge => (
                    <div 
                      key={challenge.id}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        challenge.completed 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-green-200 bg-green-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{challenge.icon}</div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{challenge.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>
                          
                          {challenge.completed ? (
                            <div className="text-sm text-green-600 font-medium">
                              ✅ Completed +{challenge.points} points
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-gray-500">
                                Progress: {challenge.progress}/{challenge.target}
                              </div>
                              <div className="text-sm font-medium text-green-600">
                                +{challenge.points} points
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyRewards;
