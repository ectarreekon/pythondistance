// static/app.js
document.addEventListener('DOMContentLoaded', () => {
    let map = L.map('map').setView([0, 0], 2);
    let latestLocation = null;
    let targetLocation = null;
    let mapLine = null;
    let markers = L.layerGroup().addTo(map);
    let savedLocations = [];
    
    // Initialize OpenStreetMap layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Load latest location and saved target locations on page load
    fetchLatestLocation();
    fetchSavedLocations();
    
    // Event listeners
    // Search button click event
    document.getElementById('search-btn').addEventListener('click', () => {
        const searchTerm = document.getElementById('location-search').value.trim();
        if (searchTerm) {
            searchLocation(searchTerm);
        }
    });
    
    // Search on Enter key
    document.getElementById('location-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const searchTerm = document.getElementById('location-search').value.trim();
            if (searchTerm) {
                searchLocation(searchTerm);
            }
        }
    });
    
    // Dropdown change event
    document.getElementById('saved-locations').addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (selectedId) {
            const selected = savedLocations.find(loc => loc._id.$oid === selectedId);
            if (selected) {
                selectSavedLocation(selected);
                // Clear search field if there was anything there
                document.getElementById('location-search').value = '';
            }
        }
    });
    
    // Fetch latest location from the database
    function fetchLatestLocation() {
        fetch('/api/latest-location')
            .then(response => response.json())
            .then(data => {
                if (data) {
                    latestLocation = data;
                    
                    //print(latestLocation)
                    updateMap();
                }
            })
            .catch(error => console.error('Error fetching latest location:', error));
    }
    
    // Fetch saved target locations from the database
    function fetchSavedLocations() {
        fetch('/api/targets')
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    savedLocations = data;
                    populateDropdown(data);
                }
            })
            .catch(error => console.error('Error fetching saved locations:', error));
    }
    
    // Populate dropdown with saved locations
    function populateDropdown(locations) {
        const dropdown = document.getElementById('saved-locations');
        
        // Clear existing options except the first one
        while (dropdown.options.length > 1) {
            dropdown.remove(1);
        }
        
        // Add locations to dropdown
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location._id.$oid;
            option.textContent = location.location_details.display_name;
            dropdown.appendChild(option);
        });
    }
    
    // Select location from saved locations dropdown
    function selectSavedLocation(location) {
        targetLocation = {
            _id: location._id,
            latitude: location.latitude,
            longitude: location.longitude,
            location_details: location.location_details,
            timestamp: location.timestamp
        };
        
        // Update map with both locations
        updateMap();
        
        // Calculate and display distance
        if (latestLocation) {
            calculateDistance();
        }
        
        // Hide search results if they were shown
        document.getElementById('search-results').classList.add('hidden');
    }
    
    // Search location using OpenStreetMap Nominatim API
    function searchLocation(query) {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                displaySearchResults(data);
            })
            .catch(error => console.error('Error searching location:', error));
    }
    
    // Display search results
    function displaySearchResults(results) {
        const resultsList = document.getElementById('results-list');
        resultsList.innerHTML = '';
        
        if (results.length === 0) {
            resultsList.innerHTML = '<li>No results found</li>';
        } else {
            results.forEach(result => {
                const li = document.createElement('li');
                li.textContent = result.display_name;
                li.addEventListener('click', () => selectLocation(result));
                resultsList.appendChild(li);
            });
        }
        
        document.getElementById('search-results').classList.remove('hidden');
    }
    
    // Handle location selection from search results
    function selectLocation(location) {
        const locationtime = location.timestamp
        // Prepare location details
        const locationDetails = {
            display_name: location.display_name,
            road: location.address?.road || '',
            city: location.address?.city || location.address?.town || location.address?.village || '',
            county: location.address?.county || '',
            state: location.address?.state || '',
            country: location.address?.country || '',
            postcode: location.address?.postcode || ''
        };
        
        // Create target location object
        targetLocation = {
            latitude: parseFloat(location.lat),
            longitude: parseFloat(location.lon),
            location_details: locationDetails
        };
        
        // Save target location to database
        saveTargetLocation();
        
        // Hide search results
        document.getElementById('search-results').classList.add('hidden');
        
        // Update map with both locations
        updateMap();
        
        // Calculate and display distance
        if (latestLocation) {
            calculateDistance();
        }
    }
    
    // Save target location to the database
    function saveTargetLocation() {
        fetch('/api/save-target', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(targetLocation)
        })
        .then(response => response.json())
        .then(data => {
            targetLocation = data;
            // Refresh the saved locations list
            fetchSavedLocations();
        })
        .catch(error => console.error('Error saving target location:', error));
    }
    
    // Calculate distance between latest and target locations
    function calculateDistance() {
        fetch('/api/distance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                latest: latestLocation,
                target: targetLocation
            })
        })
        .then(response => response.json())
        .then(data => {
            displayDistance(data.distance);
        })
        .catch(error => console.error('Error calculating distance:', error));
    }
    
    // Display distance information
    function displayDistance(distance) {
        document.getElementById('from-location').textContent = latestLocation.location_details.display_name;
        document.getElementById('to-location').textContent = targetLocation.location_details.display_name;
        document.getElementById('distance').textContent = distance.toFixed(2);
        document.getElementById('distance-container').classList.remove('hidden');
    }
    
    // Update map with markers and line
    function updateMap() {
        // Clear existing markers
        markers.clearLayers();
        
        // If we have a line, remove it
        if (mapLine) {
            map.removeLayer(mapLine);
        }
        
        // Add latest location marker if available
        if (latestLocation) {
            const latestMarker = L.marker([latestLocation.latitude, latestLocation.longitude], {
                title: 'Current Location'
            });
            //print(latestLocation)
            ltime = latestLocation
            time2 = new Date(ltime.timestamp)
            latestMarker.bindPopup(`
                <b>Current Location</b><br>${latestLocation.location_details.display_name}
                
                `);
                //<br><br><b>Time:</b>${time2.toLocaleString()}
            markers.addLayer(latestMarker);
        }
        
        // Add target location marker if available
        if (targetLocation) {
            const targetMarker = L.marker([targetLocation.latitude, targetLocation.longitude], {
                title: 'Target Location'
            });
            targetMarker.bindPopup(`<b>Target Location</b><br>${targetLocation.location_details.display_name}`);
            markers.addLayer(targetMarker);
        }
        
        // If both locations are available, draw a line between them
        if (latestLocation && targetLocation) {
            mapLine = L.polyline([
                [latestLocation.latitude, latestLocation.longitude],
                [targetLocation.latitude, targetLocation.longitude]
            ], {
                color: 'blue',
                weight: 3,
                opacity: 0.7
            }).addTo(map);

        // if (targetLocation) {
        //     mapLine = L.polyline([
        //         //[latestLocation.latitude, latestLocation.longitude],
        //         [targetLocation.latitude, targetLocation.longitude]
        //     ], {
        //         color: 'green',
        //         weight: 3,
        //         opacity: 0.7
        //     }).addTo(map);            
            
            // Fit map to show both markers
            const bounds = L.latLngBounds(
                [latestLocation.latitude, latestLocation.longitude],
                [targetLocation.latitude, targetLocation.longitude]
            );
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (latestLocation) {
            // If only latest location is available, center on it
            map.setView([latestLocation.latitude, latestLocation.longitude], 13);
        }
    }
});
