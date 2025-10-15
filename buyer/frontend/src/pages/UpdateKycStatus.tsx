const updateKYCStatus = async (userId:any, kycStatus:any) => {
    try {
      const response = await fetch('/api/update-kyc-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, kycStatus }),
      });
  
      const data = await response.json();
      if (response.ok) {
        alert('KYC Status updated successfully');
        console.log(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.log('Error:', error);
    }
  };
  
  // Usage example
  updateKYCStatus('6762bc54cc96b8c565967c16', 'approved');
  