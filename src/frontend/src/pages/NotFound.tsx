import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

const NotFound = () => {
  useEffect(() => {
    document.title = 'Clarive — Page Not Found';
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <h1 className="text-7xl font-extrabold tracking-tighter text-foreground">404</h1>
        <h2 className="text-lg font-semibold text-foreground">Page not found</h2>
        <p className="text-foreground-muted max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild>
          <Link to="/library">Back to Library</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
