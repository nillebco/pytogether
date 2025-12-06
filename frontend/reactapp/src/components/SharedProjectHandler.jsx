import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../axiosConfig";

export default function SharedProjectHandler() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const validateAndJoin = async () => {
      try {
        const res = await api.post('/api/validate-share-link/', { token });
        
        if (res.data.valid) {
            // Check if user is authenticated
            const isAuthenticated = !!sessionStorage.getItem("access_token");
            
            // Redirect to the appropriate IDE route based on authentication status
            // PyIDE will read 'shareToken' from state and attach it to the WebSocket connection
            const targetRoute = isAuthenticated ? '/ide' : '/shared-ide';
            
            navigate(targetRoute, {
                state: {
                    groupId: res.data.group_id,
                    projectId: res.data.project_id,
                    projectName: res.data.project_name,
                    shareToken: token 
                },
                replace: true
            });
        }
      } catch (err) {
        console.error("Invalid link", err);
        alert("This invitation link is invalid or has expired.");
        // Redirect to landing page for anonymous users, home for authenticated
        const isAuthenticated = !!sessionStorage.getItem("access_token");
        navigate(isAuthenticated ? '/home' : '/');
      }
    };

    if (token) {
        validateAndJoin();
    }
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 font-medium animate-pulse">Joining session...</p>
        </div>
    </div>
  );
}