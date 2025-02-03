"use client"
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const BalancesPage = () => {
    const router = useRouter();
    const [balances, setBalances] = useState({});
    const [totalSupply, setTotalSupply] = useState(0);

    useEffect(() => {
        fetch('/api/balances')
            .then(response => response.json())
            .then(data => {
                setBalances(data.balances);
                setTotalSupply(data.total_supply);
            });
    }, []);

    return (
        <div>
            <button 
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 mb-4"
            >
                Back to Home
            </button>

            <h1>Balances</h1>
            <p>Total Supply: {totalSupply}</p>
            <ul>
                {Object.entries(balances).map(([user, balance]) => (
                    <li key={user}>{user}: {String(balance)}</li>
                ))}
            </ul>
        </div>
    );
};

export default BalancesPage; 