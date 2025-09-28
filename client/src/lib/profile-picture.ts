import defaultProfileIcon from '@/assets/default-profile.webp';

interface ProfilePictureOptions {
  profilePicture?: string | null;
  showPhotosChat?: boolean;
  size?: 'small' | 'medium' | 'large';
  useThumbnail?: boolean;
}

/**
 * Utility function to get the appropriate profile picture URL
 * Handles fallback to default icon and future thumbnail support
 */
export function getProfilePictureUrl({
  profilePicture,
  showPhotosChat = true,
  size = 'medium',
  useThumbnail = false
}: ProfilePictureOptions): string {
  // Return default icon if photos are disabled or no picture available
  if (!showPhotosChat || !profilePicture) {
    return defaultProfileIcon;
  }

  // Future support for thumbnail URLs based on size
  if (useThumbnail && profilePicture.includes('original')) {
    // Example: Replace 'original' with 'thumb_small', 'thumb_medium', etc.
    // This is placeholder logic for future thumbnail support
    const thumbnailSizes = {
      small: 'thumb_48',
      medium: 'thumb_96',
      large: 'thumb_256'
    };
    
    return profilePicture.replace('original', thumbnailSizes[size]);
  }

  return profilePicture;
}

/**
 * Get dimensions based on avatar size class
 */
export function getAvatarDimensions(sizeClass: string): { width: number; height: number } {
  // Extract size from class name (e.g., "w-12 h-12" -> 12 * 4 = 48px)
  const sizeMatch = sizeClass.match(/w-(\d+)/);
  if (sizeMatch) {
    const size = parseInt(sizeMatch[1]) * 4; // Tailwind uses 4px base
    return { width: size, height: size };
  }
  
  // Default to 48x48
  return { width: 48, height: 48 };
}