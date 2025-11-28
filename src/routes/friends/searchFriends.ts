import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

// Search for users to add as friends
router.get('/:userId', async (req: Request, res: Response) => {
  console.log('Searching for friends...');
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
    const userData = userDoc.exists ? userDoc.data() : {};
    const currentUserFriends = Array.isArray(userData?.friends) ? (userData.friends as string[]) : [];
    const currentUserRequested = Array.isArray(userData?.requested) ? (userData.requested as string[]) : [];
    const currentUserRequests = Array.isArray(userData?.requests) ? (userData.requests as string[]) : [];
    const excludedIds = new Set<string>([
      userId,
      ...currentUserFriends,
      ...currentUserRequested,
      ...currentUserRequests,
    ]);

    // Search users by username only
    const usersCollection = db.collection('users');
    
    // Get all users and filter in memory for case-insensitive partial match
    const allUsersQuery = await usersCollection.get();
    
    const foundUsers: any[] = [];

    allUsersQuery.forEach(doc => {
      const userData = doc.data();
      const docId = doc.id;
      
      // Exclude current user and existing friends
      if (!excludedIds.has(docId)) {
        const username = (userData.username || '').toLowerCase();
        
        // Check if username contains the search term (case-insensitive partial match)
        if (username.includes(searchTerm)) {
          foundUsers.push({
            id: docId,
            displayName: userData.displayName || 'Unknown User',
            username: userData.username || null,
            email: userData.email || '',
            profileId: userData.profileId || null,
            isFriend: false,
          });
        }
      }
    });

    // Sort by username and limit results
    const searchResults = foundUsers
      .sort((a, b) => {
        const aUsername = (a.username || '').toLowerCase();
        const bUsername = (b.username || '').toLowerCase();
        // Prioritize matches that start with search term
        const aStarts = aUsername.startsWith(searchTerm);
        const bStarts = bUsername.startsWith(searchTerm);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aUsername.localeCompare(bUsername);
      })
      .slice(0, 15);

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