import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import focusRoutes from './routes/focus/postFocusTime';
import accountRoutes from './routes/insights/getInsights';
import weeklyFocusRoute from './routes/insights/getWeeklyFocus';
import monthlySummaryRoute from './routes/insights/getMonthlySummary';
import updateProfileRoute from './routes/user/updateProfile';
import getUserProfileRoute from './routes/user/getUserProfile';
import getFriendsRoute from './routes/friends/getFriends';
import searchFriendsRoute from './routes/friends/searchFriends';
import addFriendRoute from './routes/friends/addFriend';
import removeFriendRoute from './routes/friends/removeFriend';
import setupProfileRoute from './routes/auth/setupProfile';
import checkUserStatusRoute from './routes/auth/checkUserStatus';
import saveUserInfoRoute from './routes/auth/saveUserInfo';
import storeCatalogRoute from './routes/store/getStoreCatalog';
import legendaryCatalogRoute from './routes/store/getLegendaryCatalog';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/focus', focusRoutes);

app.use('/api/account', accountRoutes);
app.use('/api/account', weeklyFocusRoute);
app.use('/api/focus', monthlySummaryRoute);

app.use('/api/user', updateProfileRoute);
app.use('/api/user', getUserProfileRoute);

app.use('/api/get_friends', getFriendsRoute);
app.use('/api/search_friends', searchFriendsRoute);
app.use('/api/friends', addFriendRoute);
app.use('/api/friends', removeFriendRoute);

app.use('/api/auth', setupProfileRoute);
app.use('/api/auth', checkUserStatusRoute);
app.use('/api/auth', saveUserInfoRoute);

app.use('/api/store', storeCatalogRoute);
app.use('/api/store', legendaryCatalogRoute);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Petly Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Petly Backend server is running on port ${PORT}`);
});

export default app;
