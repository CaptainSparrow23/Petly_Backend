import { Router, Request, Response } from 'express';
import petDataJson from '../../data/petData.json';

const router = Router();

interface PetData {
  id: string;
  name: string;
  species: string;
  priceCoins: number;
  imageKey: string;
  description: string;
}

router.post('/owned', async (req: Request, res: Response) => {
  const { ownedPets } = req.body;

  console.log(`🐾 Received request to get owned pets metadata`);

  if (!Array.isArray(ownedPets)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: ownedPets must be an array',
    });
  }

  try {
    const petData = petDataJson as PetData[];
    
    // Filter pet data to only include pets owned by the user
    const ownedPetsData = petData.filter(pet => ownedPets.includes(pet.id));

    // Transform the data to include proper structure for frontend
    const transformedPets = ownedPetsData.map(pet => ({
      id: pet.id,
      name: pet.name,
      type: pet.species,
      rating: 3, // Default rating for all pets
      image: 'skye', // Using skye as default image key as per instructions
    }));

    console.log(`✅ Retrieved ${transformedPets.length} owned pets`);

    return res.status(200).json({
      success: true,
      data: transformedPets,
      message: 'Owned pets retrieved successfully',
    });
  } catch (error) {
    console.error('❌ Failed to get owned pets:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred while fetching owned pets';

    return res.status(500).json({
      success: false,
      error: 'Failed to get owned pets',
      message: errorMessage,
    });
  }
});

export default router;
