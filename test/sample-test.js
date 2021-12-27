const { expect } = require("chai");

// Symetrical hash of a pair so we won't care if the order is reversed.
// This code also converts between the string the hash function expects
// and the BigInt we rest of the code uses
const pairHash = (a,b) => BigInt(ethers.utils.keccak256('0x' + 
       (a^b).toString(16).padStart(64,0)))



// The value to denote that a certain branch is empty, doesn't
// have a value
const empty = 0n


// Calculate one level up the tree of a hash array by taking the hash of 
// each pair in sequence
const oneLevelUp = inputArray => {
    var result = []
    var inp = [...inputArray]    // To avoid over writing the input

    // Add an empty value if necessary (we need all the leaves to be
    // paired)
    if (inp.length % 2 === 1)
        inp.push(empty)

    for(var i=0; i<inp.length; i+=2)
        result.push(pairHash(inp[i],inp[i+1]))

    return result
}    // oneLevelUp


// Get the merkle root of a hashArray
const getMerkleRoot = inputArray => {
    var result

    result = [...inputArray]

    // Climb up the tree until there is only one value, that is the
    // root. 
    //
    // Note that if a layer has an odd number of entries the
    // code in oneLevelUp adds an empty value, so if we have, for example,
    // 10 leaves we'll have 5 branches in the second layer, 3
    // branches in the third, 2 in the fourth and the root is the fifth       
    while(result.length > 1)
        result = oneLevelUp(result)

    return result[0]
}


// A merkle proof consists of the value of the list of entries to 
// hash with. Because we use a symmetrical hash function, we don't
// need the item's location to verify, only to create the proof.
const getMerkleProof = (inputArray, n) => {
    var result = [], currentLayer = [...inputArray], currentN = n

    // Until we reach the top
    while (currentLayer.length > 1) {
        // No odd length layers
        if (currentLayer.length % 2)
            currentLayer.push(empty)

        result.push(currentN % 2    
               // If currentN is odd, add the value before it
            ? currentLayer[currentN-1] 
               // If it is even, add the value after it
            : currentLayer[currentN+1])

        // Move to the next layer up
        currentN = Math.floor(currentN/2)
        currentLayer = oneLevelUp(currentLayer)
    }   // while currentLayer.length > 1

    return result
}   // getMerkleProof





describe("MerkleProof", () => {
  it("Should let us change the Merkle root", async () => {
    const TestRoot = "0xBAD060A7"

    const factory = await ethers.getContractFactory("MerkleProof")
    const contract = await factory.deploy()
    await contract.deployed()

    const setRootTx = await contract.setRoot(TestRoot)
    await setRootTx.wait()

    const root = await contract.getRoot()

    expect(root.toHexString().toLowerCase()).to.equal(TestRoot.toLowerCase())
  })  // it should let us change the Merkle root

  it("Should reject invalid proofs", async () => {
    const factory = await ethers.getContractFactory("MerkleProof")
    const contract = await factory.deploy()
    await contract.deployed()

    const proof = [0, 1, 2, 3]
    const res = await contract.verifyProof(0, proof)

    expect(res).to.equal(false)
  })   // it should reject invalid proofs


  it("Should accept valid proofs", async () => {

    const dataArray = [
      0x0BAD0010n,
      0x60A70020n,
      0xBEEF0030n,
      0xDEAD0040n,
      0xCA110050n,
      0x0E660060n,
      0xFACE0070n,
      0xBAD00080n,
      0x060D0091n
    ]
    const itemToProve = 3

    const factory = await ethers.getContractFactory("MerkleProof")
    const contract = await factory.deploy()
    await contract.deployed()

    const root = getMerkleRoot(dataArray)

    const setRootTx = await contract.setRoot(root)
    await setRootTx.wait()

    const onchainRoot = await contract.getRoot()

    // If the roots mismatch of course nothing will work
    expect(root).to.equal(onchainRoot)

    const proof = getMerkleProof(dataArray, itemToProve)

    const res = await contract.verifyProof(dataArray[itemToProve], proof)

    expect(res).to.equal(true)
  })    // it should accept valid proofs

})  // describe MerkleProof
