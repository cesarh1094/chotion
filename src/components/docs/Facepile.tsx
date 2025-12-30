interface FacepileUser {
  userId: string;
  name: string;
  image?: string;
}

interface FacepileProps {
  users: FacepileUser[];
  max?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// Generate a consistent color from a string
function getColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    "bg-red-100 text-red-700",
    "bg-orange-100 text-orange-700",
    "bg-amber-100 text-amber-700",
    "bg-yellow-100 text-yellow-700",
    "bg-lime-100 text-lime-700",
    "bg-green-100 text-green-700",
    "bg-emerald-100 text-emerald-700",
    "bg-teal-100 text-teal-700",
    "bg-cyan-100 text-cyan-700",
    "bg-sky-100 text-sky-700",
    "bg-blue-100 text-blue-700",
    "bg-indigo-100 text-indigo-700",
    "bg-violet-100 text-violet-700",
    "bg-purple-100 text-purple-700",
    "bg-fuchsia-100 text-fuchsia-700",
    "bg-pink-100 text-pink-700",
    "bg-rose-100 text-rose-700",
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

export function Facepile({ users, max = 5 }: FacepileProps) {
  if (users.length === 0) return null;

  const shown = users.slice(0, max);
  const overflow = users.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((user) => (
        <div
          key={user.userId}
          title={user.name}
          className="relative h-8 w-8 rounded-full border-2 border-background overflow-hidden flex-shrink-0"
        >
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={`h-full w-full flex items-center justify-center text-xs font-medium ${getColorFromString(user.userId)}`}
            >
              {getInitials(user.name || "U")}
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="h-8 px-2 rounded-full border-2 border-background bg-muted text-xs font-medium flex items-center justify-center"
          title={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}



