// Fonction pour ajouter un bien immobilier via l'API Finary
async function addUserRealEstate(data) {
  const apiUrl = 'https://api.finary.com/users/me/real_estates';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_automated_valuation: false,
        is_furnished: false,
        is_new: false,
        has_lift: false,
        has_sauna: false,
        has_pool: false,
        flooring_quality: '',
        flooring_condition: '',
        windows_quality: '',
        windows_condition: '',
        bathrooms_quality: '',
        bathrooms_condition: '',
        kitchen_quality: '',
        kitchen_condition: '',
        general_quality: '',
        general_condition: '',
        parking_spaces: '',
        garage_spaces: '',
        number_of_rooms: '',
        number_of_bathrooms: '',
        number_of_floors: '',
        floor_number: '',
        balcony_area: '',
        garden_area: '',
        category: data.category,
        is_estimable: false,
        user_estimated_value: Number(data.user_estimated_value),
        description: data.description,
        surface: Number(data.surface),
        agency_fees: '',
        notary_fees: '',
        furnishing_fees: '',
        renovation_fees: '',
        buying_price: Number(data.buying_price),
        building_type: data.building_type,
        ownership_percentage: parseFloat(data.ownership_percentage),
        place_id: data.place_id,
        ...(data.category === 'rent' && {
          monthly_charges: Number(data.monthly_charges),
          monthly_rent: Number(data.monthly_rent),
          yearly_taxes: Number(data.yearly_taxes),
          rental_period: data.rental_period,
          rental_type: data.rental_type,
        }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP! Statut: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur lors de l'ajout du bien immobilier:", error);
    return null;
  }
}

export { addUserRealEstate };
