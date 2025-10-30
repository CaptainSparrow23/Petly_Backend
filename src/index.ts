import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import postFocusSession from './routes/focus/postFocusSession';
import updateProfileRoute from './routes/user/updateProfile';
import getUserProfileRoute from './routes/user/getUserProfile';
import getFriendsRoute from './routes/friends/getFriends';
import searchFriendsRoute from './routes/friends/searchFriends';
import addFriendRoute from './routes/friends/addFriend';
import removeFriendRoute from './routes/friends/removeFriend';
import setupProfileRoute from './routes/user/setupProfile';
import checkUserStatusRoute from './routes/user/checkUserStatus';
import saveUserInfoRoute from './routes/user/saveUserInfo';
import storeCatalogRoute from './routes/store/getStoreCatalog';
import purchasePetRoute from './routes/store/purchasePet';
import updateSelectedPetRoute from './routes/pets/updateSelectedPet';
import getStreak from './routes/insights/checkAndGetStreak';
import getTodayFocus from './routes/insights/getTodayFocus';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/post_focus_session", postFocusSession);

app.use('/api/get_streak', getStreak);
app.use('/api/get_today_focus', getTodayFocus);

app.use('/api/get_friends', getFriendsRoute);
app.use('/api/search_friends', searchFriendsRoute);
app.use('/api/friends', addFriendRoute);
app.use('/api/friends', removeFriendRoute);

app.use('/api/user', updateProfileRoute);
app.use('/api/get_user_profile', getUserProfileRoute);
app.use('/api/auth', setupProfileRoute);
app.use('/api/auth', checkUserStatusRoute);
app.use('/api/auth', saveUserInfoRoute);

app.use('/api/store', storeCatalogRoute);
app.use('/api/store', purchasePetRoute);

app.use('/api/pets/update_pet', updateSelectedPetRoute);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Petly Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Petly Backend server is running on port ${PORT}`);
});

export default app;
