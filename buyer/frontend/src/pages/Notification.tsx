// export default Notification;
import React, { useState, useEffect } from "react";
import api from "../utils/api";

interface User {
  _id: string;
  fullname: { firstname: string; lastname: string };
  email: string;
  name?: string; // your DB uses "name" instead of "username"
}

const Notification: React.FC = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState("deviceToken"); // deviceToken, username, email, userId, fullName, selectedUsers, allUsers
  const [targetValue, setTargetValue] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch all users from backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get<{ users: User[] }>("/admin/users");
        setUsers(res.data.users);
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to load users.");
      }
    };
    fetchUsers();
  }, []);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSendNotification = async () => {
    if (!title || !body) {
      setErrorMsg("Title and body are required.");
      return;
    }

    if (
      targetType !== "allUsers" &&
      targetType !== "selectedUsers" &&
      !targetValue
    ) {
      setErrorMsg("Please enter a target value.");
      return;
    }

    if (targetType === "selectedUsers" && selectedUsers.length === 0) {
      setErrorMsg("Please select at least one user.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload: Record<string, any> = { title, body };

      if (targetType === "allUsers") {
        payload.allUsers = true;
      } else if (targetType === "selectedUsers") {
        payload.userIds = selectedUsers;
      } else {
        payload[targetType] = targetValue;
      }

      await api.post("/admin/firebase", payload);

      setSuccessMsg("Notification sent successfully!");
      setTitle("");
      setBody("");
      setTargetValue("");
      setSelectedUsers([]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || "Failed to send notification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Send Notification</h2>

      {/* Title */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full border p-2 rounded-md"
          placeholder="Enter notification title"
        />
      </div>

      {/* Body */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Body / Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 block w-full border p-2 rounded-md"
          placeholder="Enter notification body"
        />
      </div>

      {/* Target Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Target Type
        </label>
        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          className="mt-1 block w-full border p-2 rounded-md"
        >
          <option value="deviceToken">Device Token</option>
          <option value="username">Username</option>
          <option value="email">Email</option>
          <option value="userId">User ID</option>
          <option value="fullName">Full Name</option>
          <option value="selectedUsers">Select Users</option>
          <option value="allUsers">All Users</option>
        </select>
      </div>

      {/* Target Value Input */}
      {targetType !== "allUsers" && targetType !== "selectedUsers" && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Target Value
          </label>
          <input
            type="text"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="mt-1 block w-full border p-2 rounded-md"
            placeholder={`Enter ${targetType}`}
          />
        </div>
      )}

      {/* User Selection */}
      {targetType === "selectedUsers" && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Select Users
          </label>
          <div className="border p-2 rounded-md max-h-48 overflow-y-auto">
            {users.map((user) => (
              <div key={user._id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user._id)}
                  onChange={() => toggleUserSelection(user._id)}
                  className="mr-2"
                />
                <span>
                  {user.fullname?.firstname} {user.fullname?.lastname} (
                  {user.email})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}
      {successMsg && <p className="text-green-500 mb-2">{successMsg}</p>}

      <button
        onClick={handleSendNotification}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-all"
      >
        {loading ? "Sending..." : "Send Notification"}
      </button>
    </div>
  );
};

export default Notification;
