import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

// Search for users to add as friends
router.get('/search/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { query } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query must be at least 2 characters long' 
      });
    }

    const searchTerm = query.trim().toLowerCase();

    // Get current user's friends list to exclude from search
    const userDoc = await db.collection('users').doc(userId).get();
    const currentUserFriends = userDoc.exists ? (userDoc.data()?.friends || []) : [];

    // Search users by username and name
    const usersCollection = db.collection('users');
    
    // Search by username
    const usernameQuery = await usersCollection
      .where('username', '>=', searchTerm)
      .where('username', '<=', searchTerm + '\uf8ff')
      .limit(20)
      .get();

    // Search by name (case insensitive)
    const nameQuery = await usersCollection
      .orderBy('name')
      .startAt(searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1))
      .endAt(searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1) + '\uf8ff')
      .limit(20)
      .get();

    const foundUsers = new Map();

    // Process username results
    usernameQuery.forEach(doc => {
      const userData = doc.data();
      const docId = doc.id;
      
      // Exclude current user and existing friends
      if (docId !== userId && !currentUserFriends.includes(docId)) {
        foundUsers.set(docId, {
          id: docId,
          name: userData.name || 'Unknown User',
          username: userData.username || null,
          email: userData.email || '',
          avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=6366f1&color=fff`,
          isFriend: false,
        });
      }
    });

    // Process name results
    nameQuery.forEach(doc => {
      const userData = doc.data();
      const docId = doc.id;
      
      // Exclude current user and existing friends
      if (docId !== userId && !currentUserFriends.includes(docId)) {
        // Check if name contains search term (case insensitive)
        if (userData.name && userData.name.toLowerCase().includes(searchTerm)) {
          foundUsers.set(docId, {
            id: docId,
            name: userData.name || 'Unknown User',
            username: userData.username || null,
            email: userData.email || '',
            avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=6366f1&color=fff`,
            isFriend: false,
          });
        }
      }
    });

    const searchResults = Array.from(foundUsers.values()).slice(0, 15);

    return res.json({ 
      success: true, 
      data: { users: searchResults } 
    });

  } catch (error) {
    console.error('❌ Error searching users:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to search users' 
    });
  }
});

export default router;