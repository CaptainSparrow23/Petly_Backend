import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import postFocusSession from './routes/focus/postFocusSession';
import updateProfileRoute from './routes/user/updateProfile';
import getUserProfileRoute from './routes/user/getUserProfile';
import getFriendsRoute from './routes/friends/getFriends';
import searchFriendsRoute from './routes/friends/searchFriends';
import addFriendRoute from './routes/friends/addFriend';
import removeFriendRoute from './routes/friends/removeFriend';
import requestFriendRoute from './routes/friends/requestFriend';
import respondFriendRoute from './routes/friends/respondFriendRequest';
import setupProfileRoute from './routes/user/setupProfile';
import checkUserStatusRoute from './routes/user/checkUserStatus';
import saveUserInfoRoute from './routes/user/saveUserInfo';
import storeCatalogRoute from './routes/store/getStoreCatalog';
import rotatedCatalogRoute from './routes/store/getRotatedCatalog';
import purchasePetRoute from './routes/store/purchasePet';
import featuredSetsRoute from './routes/store/getFeaturedSets';
import getStreak from './routes/insights/checkAndGetStreak';
import getGoals from './routes/insights/getGoals';
import focusRangeRouter from './routes/insights/getFocusRange';
import tagDistributionRouter from './routes/insights/getTagDistribution';
import claimGoalRewardRoute from './routes/insights/claimGoalReward';
import claimLevelRewardRoute from './routes/rewards/claimLevelReward';
import { focusWeekRouter } from './routes/insights/getWeeklyFocus';
import updateSelectedPetRoute from './routes/pets/updateSelectedPet';
import updateSelectedAccessoriesRoute from './routes/pets/updateSelectedAccessories';
import getOwnedPetsRoute from './routes/pets/getOwnedPets';
import updateTagsRoute from './routes/user/updateTags';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/post_focus_session", postFocusSession);

//insights page
app.use('/api/get_streak', getStreak);
app.use('/api/get_week_focus', focusWeekRouter);
app.use('/api/get_goals', getGoals);
app.use('/api/get_focus_range', focusRangeRouter);
app.use('/api/get_tag_distribution', tagDistributionRouter);
app.use('/api/claim_goal_reward', claimGoalRewardRoute);
app.use('/api/claim_level_reward', claimLevelRewardRoute);

app.use('/api/get_friends', getFriendsRoute);
app.use('/api/search_friends', searchFriendsRoute);
app.use('/api/friends', addFriendRoute);
app.use('/api/friends', removeFriendRoute);
app.use('/api/friends', requestFriendRoute);
app.use('/api/friends', respondFriendRoute);

app.use('/api/user', updateProfileRoute);
app.use('/api/user', updateTagsRoute);
app.use('/api/get_user_profile', getUserProfileRoute);
app.use('/api/auth', setupProfileRoute);
app.use('/api/auth', checkUserStatusRoute);
app.use('/api/auth', saveUserInfoRoute);

app.use('/api/store', storeCatalogRoute);
app.use('/api/store', rotatedCatalogRoute);
app.use('/api/store', purchasePetRoute);
app.use('/api/store', featuredSetsRoute);

app.use('/api/pets/update_pet', updateSelectedPetRoute);
app.use('/api/pets/update_accessories', updateSelectedAccessoriesRoute);
app.use('/api/pets', getOwnedPetsRoute);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Petly Backend server is running on port ${PORT}`);
});

export default app;
